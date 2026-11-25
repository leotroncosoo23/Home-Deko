import "server-only";
import { createHmac } from "node:crypto";
import { headers } from "next/headers";

/**
 * Clave anónima del VISITANTE para los límites de intentos (cupones,
 * Botón de arrepentimiento…).
 *
 * - Es un hash de su IP con una clave del servidor (ORDER_LINK_SECRET): la IP
 *   nunca se guarda en claro y nadie puede rearmarla desde la base.
 * - `scope` separa los contadores: el mismo visitante tiene una clave distinta
 *   para cada cosa ("cupon", "arrepentimiento").
 * - Los intentos se cuentan en la BASE, no en la memoria del servidor: en
 *   Vercel cada pedido puede caer en una instancia distinta.
 *
 * Devuelve null si falta la clave del servidor (la consola avisa).
 */
export async function visitorKey(scope: string): Promise<string | null> {
  const secret = process.env.ORDER_LINK_SECRET;
  if (!secret) {
    console.error(`[${scope}] falta ORDER_LINK_SECRET (se usa para el límite de intentos)`);
    return null;
  }
  const h = await headers();
  // En Vercel, x-forwarded-for trae primero la IP real del visitante.
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "sin-ip";
  return createHmac("sha256", secret).update(`${scope}:${ip}`).digest("hex");
}
