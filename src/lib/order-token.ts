import "server-only";
import { createHash, createHmac } from "node:crypto";
import { requireEnv } from "@/lib/env";
import { siteUrl } from "@/lib/site-url";

/**
 * Link secreto para que un INVITADO (sin cuenta) vea su pedido:
 *   /pedido/{id}?t={token}
 *
 * - El token se DERIVA del id del pedido con una clave del servidor
 *   (HMAC-SHA256 con ORDER_LINK_SECRET): imposible de adivinar sin la clave,
 *   y el servidor lo puede volver a armar cuando quiera (para los mails y el
 *   WhatsApp que mandan los dueños).
 * - En la base se guarda solo su hash (sha256). Si alguien leyera la tabla,
 *   igual no podría armar los links.
 * - Sin el token correcto, la página responde "no encontrado", igual que si
 *   el pedido no existiera: cambiar el id en la URL no muestra nada ajeno.
 *
 * ORDER_LINK_SECRET NO se cambia nunca: si cambia, los links de todos los
 * pedidos anteriores dejan de funcionar.
 */
export function orderToken(orderId: string): string {
  return createHmac("sha256", requireEnv("ORDER_LINK_SECRET")).update(`pedido:${orderId}`).digest("base64url");
}

export function createOrderToken(orderId: string): { token: string; hash: string } {
  const token = orderToken(orderId);
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

/**
 * Link completo al pedido para el cliente (mails y WhatsApp), o null si no
 * se puede armar (falta la URL del sitio o la clave).
 */
export function customerOrderUrl(orderId: string): string | null {
  const base = siteUrl();
  if (!base || !process.env.ORDER_LINK_SECRET) return null;
  return `${base}${orderPath(orderId, orderToken(orderId))}`;
}
