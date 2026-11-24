/**
 * Rutas que se ven SIEMPRE, aunque la tienda esté en modo construcción
 * (la página "Muy pronto" del paso 0 no las tiene que tapar).
 *
 *   - /privacidad y /terminos: Google las pide públicas para el inicio de
 *     sesión con Google y la verificación de la marca.
 *   - /auth y /sin-acceso: para que los dueños puedan entrar. (/admin/login y
 *     la redirección del /login viejo los resuelve el proxy antes de llegar acá.)
 *   - /api/mercadopago: los avisos de pago (webhook). Mercado Pago no tiene
 *     sesión; si no estuviera acá, el aviso terminaría en "Muy pronto".
 *     La seguridad la da la firma del aviso, no el proxy.
 *
 * Las usa src/proxy.ts. Si sumás una página que tenga que verse siempre,
 * agregala acá.
 */
export const ALWAYS_PUBLIC_PATHS = ["/privacidad", "/terminos", "/auth", "/sin-acceso", "/api/mercadopago"];

/** true si la ruta (o una subruta, ej. /auth/callback) está en la lista. */
export function isAlwaysPublic(pathname: string) {
  return ALWAYS_PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
