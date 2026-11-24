import "server-only";
import { createHash, randomBytes } from "node:crypto";

/**
 * Link secreto para que un INVITADO (sin cuenta) vea su pedido:
 *   /pedido/{id}?t={token}
 *
 * - El token son 32 bytes al azar (imposible de adivinar).
 * - En la base se guarda solo su hash (sha256). Si alguien leyera la tabla,
 *   igual no podría armar los links.
 * - Sin el token correcto, la página responde "no encontrado", igual que si
 *   el pedido no existiera: cambiar el id en la URL no muestra nada ajeno.
 */
export function createOrderToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashOrderToken(token) };
}

export function hashOrderToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Formato válido de token (para descartar basura antes de consultar). */
export function isOrderTokenShape(token: unknown): token is string {
  return typeof token === "string" && /^[A-Za-z0-9_-]{43}$/.test(token);
}

export function orderPath(orderId: string, token: string): string {
  return `/pedido/${orderId}?t=${token}`;
}
