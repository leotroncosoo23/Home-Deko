/**
 * Rutas que se ven SIEMPRE, aunque la tienda esté en modo construcción
 * (la página "Muy pronto" del paso 0 no las tiene que tapar).
 *
 *   - /privacidad y /terminos: Google las pide públicas para el inicio de
 *     sesión con Google y la verificación de la marca.
 *   - /login, /auth y /sin-acceso: para que los dueños puedan entrar.
 *
 * Hoy no las usa nadie: las va a usar src/proxy.ts cuando exista el modo
 * construcción. Si sumás una página que tenga que verse siempre, agregala acá.
 */
export const ALWAYS_PUBLIC_PATHS = ["/privacidad", "/terminos", "/login", "/auth", "/sin-acceso"];

/** true si la ruta (o una subruta, ej. /auth/callback) está en la lista. */
export function isAlwaysPublic(pathname: string) {
  return ALWAYS_PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
