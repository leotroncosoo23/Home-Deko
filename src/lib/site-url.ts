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
