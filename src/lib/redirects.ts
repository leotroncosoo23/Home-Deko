/**
 * Valida el parámetro "?next=" (a dónde volver después del login).
 *
 * Solo se aceptan rutas internas que empiecen con "/". Así nadie puede
 * armar un link tipo /login?next=https://sitio-trucho.com para mandar a
 * alguien a otra web después de iniciar sesión ("open redirect").
 */
export function safeNext(next: string | null | undefined, fallback = "/admin"): string {
  if (!next) return fallback;
  // "//otro.com" y "/\otro.com" los navegadores los toman como otro sitio
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return fallback;
  }
  return next;
}
