/**
 * URL pública del sitio, sin "/" al final (para los datos estructurados de
 * Google y los links que se comparten por WhatsApp). null si no se sabe
 * (por ejemplo, en local sin NEXT_PUBLIC_SITE_URL).
 */
export function siteUrl(): string | null {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return null;
}

/**
 * Base de la URL a la que Mercado Pago manda los avisos de pago (webhook).
 *
 * Normalmente es la del sitio. Para PROBAR en la compu, Mercado Pago no
 * llega a localhost: se abre un túnel (cloudflared) y su URL va en
 * MERCADOPAGO_NOTIFICATION_URL_BASE. Así se navega en localhost:3000 (con
 * la sesión de admin) y solo el aviso de pago pasa por el túnel.
 *
 * En la producción de Vercel esa variable se IGNORA aunque esté cargada por
 * error: los avisos siempre van al dominio real.
 */
export function notificationBaseUrl(): string | null {
  const override = process.env.MERCADOPAGO_NOTIFICATION_URL_BASE;
  if (override && process.env.VERCEL_ENV !== "production") return override.replace(/\/$/, "");
  return siteUrl();
}
