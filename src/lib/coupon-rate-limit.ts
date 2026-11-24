import "server-only";
import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import type { createAdminClient } from "@/lib/supabase/admin";

/**
 * Límite de intentos de cupón: 10 por minuto por visitante, para que nadie
 * pueda probar códigos al azar.
 *
 * - Se cuenta en la BASE (coupon_attempt), no en la memoria del servidor:
 *   en Vercel cada pedido puede caer en una instancia distinta.
 * - El "visitante" es un hash de su IP con una clave del servidor
 *   (ORDER_LINK_SECRET): la IP nunca se guarda en claro.
 *
 * Devuelve true si el intento está permitido. Si algo falla (base caída,
 * falta la clave), devuelve false: mejor no aplicar un cupón que dejar la
 * puerta abierta.
 */
export async function allowCouponAttempt(supabase: ReturnType<typeof createAdminClient>): Promise<boolean> {
  const secret = process.env.ORDER_LINK_SECRET;
  if (!secret) {
    console.error("[cupones] falta ORDER_LINK_SECRET (se usa para el límite de intentos)");
    return false;
  }
  const h = await headers();
  // En Vercel, x-forwarded-for trae primero la IP real del visitante.
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "sin-ip";
  const key = createHmac("sha256", secret).update(`cupon:${ip}`).digest("hex");

  const { data, error } = await supabase.rpc("coupon_attempt", { p_key: key });
  if (error) {
    console.error("[cupones] coupon_attempt", error.message);
    return false;
  }
  return data === true;
}
