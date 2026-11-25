import "server-only";
import { visitorKey } from "@/lib/rate-limit";
import type { createAdminClient } from "@/lib/supabase/admin";

/**
 * Límite de intentos de cupón: 10 por minuto por visitante, para que nadie
 * pueda probar códigos al azar. Se cuenta en la base (coupon_attempt) con la
 * clave anónima del visitante (ver src/lib/rate-limit.ts).
 *
 * Devuelve true si el intento está permitido. Si algo falla (base caída,
 * falta la clave), devuelve false: mejor no aplicar un cupón que dejar la
 * puerta abierta.
 */
export async function allowCouponAttempt(supabase: ReturnType<typeof createAdminClient>): Promise<boolean> {
  const key = await visitorKey("cupon");
  if (!key) return false;

  const { data, error } = await supabase.rpc("coupon_attempt", { p_key: key });
  if (error) {
    console.error("[cupones] coupon_attempt", error.message);
    return false;
  }
  return data === true;
}
