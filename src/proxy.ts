import { NextResponse, type NextRequest } from "next/server";
import { isAlwaysPublic } from "@/lib/public-routes";
import { updateSession } from "@/lib/supabase/proxy";

/** Ruta interna de la página "Muy pronto" (nunca se ve en la barra de direcciones). */
const COMING_SOON_PATH = "/muy-pronto";

/**
 * Proxy (antes llamado "middleware"): corre ANTES de cada página.
 *
 * 1. Renueva la sesión de Supabase (si el token venció, pide uno nuevo).
 * 2. Protege /admin leyendo el token, sin consultar la base:
 *      sin sesión          → /login?next=...
 *      con sesión, sin rol → /sin-acceso
 * 3. Modo construcción (mientras la tienda no está lanzada):
 *      - rutas de isAlwaysPublic() (src/lib/public-routes.ts) → se ven siempre
 *      - admins → ven la tienda real (con la barra de vista previa)
 *      - visitantes → ven "Muy pronto" en CUALQUIER ruta de la tienda, sin
 *        cambiar la URL (rewrite, no redirect). En "/" se puede indexar
 *        (Google la revisa para verificar la marca); en el resto, noindex.
 *
 * Esto decide a dónde va el usuario. Los DATOS se protegen además con
 * requireAdmin() (src/lib/auth.ts, lee el rol de la base en el momento)
 * y con RLS en la base. Por eso no importa que el rol del token pueda
 * tener hasta ~1 hora de atraso.
 */
export async function proxy(request: NextRequest) {
  const { response, hasSession, role, supabase } = await updateSession(request);
  const { pathname, search } = request.nextUrl;

  // --- Panel -------------------------------------------------------------
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    if (!hasSession) {
      return redirectWithCookies(request, response, "/login", { next: pathname + search });
    }
    if (role !== "admin") {
      return redirectWithCookies(request, response, "/sin-acceso");
    }
    return response;
  }

  // --- Modo construcción -------------------------------------------------

  // "Muy pronto" no es una dirección "real": solo se muestra por el rewrite.
  if (pathname === COMING_SOON_PATH || pathname.startsWith(`${COMING_SOON_PATH}/`)) {
    return redirectWithCookies(request, response, "/");
  }

  if (isAlwaysPublic(pathname) || role === "admin") return response;

  // Visitante en una ruta de la tienda: ¿está lanzada?
  // Una fila, en el mismo datacenter (São Paulo): unos pocos milisegundos.
  // No se guarda en memoria a propósito (la doc de Next pide no depender de
  // variables globales en el proxy), así el interruptor actúa al instante.
  const { data, error } = await supabase.from("store_settings").select("is_launched").single();
  // Si la consulta falla: "Muy pronto" (mejor eso que mostrar una tienda a medias).
  const launched = !error && data?.is_launched === true;
  if (launched) return response;

  const url = request.nextUrl.clone();
  url.pathname = COMING_SOON_PATH;
  url.search = "";
  const rewrite = NextResponse.rewrite(url, { request });
  response.cookies.getAll().forEach((cookie) => rewrite.cookies.set(cookie));
  if (pathname !== "/") {
    // "Muy pronto" en otra URL sería contenido duplicado: que no se indexe.
    rewrite.headers.set("X-Robots-Tag", "noindex");
  }
  return rewrite;
}

/** Redirige conservando las cookies de sesión que se acaban de renovar. */
function redirectWithCookies(
  request: NextRequest,
  response: NextResponse,
  pathname: string,
  params: Record<string, string> = {},
) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));

  const redirect = NextResponse.redirect(url);
  response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}

export const config = {
  matcher: [
    // Todas las rutas menos archivos estáticos e imágenes (apple-icon: ícono de iPhone)
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|apple-icon|brand/|fonts/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
  ],
};
