import { NextResponse, type NextRequest } from "next/server";
import { isAlwaysPublic } from "@/lib/public-routes";
import { updateSession } from "@/lib/supabase/proxy";

/** Ruta interna de la página "Muy pronto" (nunca se ve en la barra de direcciones). */
const COMING_SOON_PATH = "/muy-pronto";

/** Ingreso de los administradores (los clientes entran en /mi-cuenta). */
const ADMIN_LOGIN_PATH = "/admin/login";

/**
 * Proxy (antes llamado "middleware"): corre ANTES de cada página.
 *
 * 1. Renueva la sesión de Supabase (si el token venció, pide uno nuevo).
 * 2. Protege /admin leyendo el token, sin consultar la base:
 *      /admin/login        → siempre (es el ingreso del panel)
 *      sin sesión          → /admin/login?next=...
 *      con sesión, sin rol → /sin-acceso  (por ejemplo, una cuenta de cliente)
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

  // --- Ingreso del panel ---------------------------------------------------
  // /admin/login es la ÚNICA ruta de /admin que se ve sin sesión. La página
  // misma decide: admin logueado → al panel; otra cuenta → /sin-acceso.
  if (pathname === ADMIN_LOGIN_PATH) return response;

  // /login era el ingreso viejo del panel: se mantiene como redirección
  // (con ?next= y ?error=) por si quedó guardado en favoritos.
  if (pathname === "/login") {
    return redirectWithCookies(request, response, ADMIN_LOGIN_PATH, Object.fromEntries(request.nextUrl.searchParams));
  }

  // --- Panel -------------------------------------------------------------
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    if (!hasSession) {
      return redirectWithCookies(request, response, ADMIN_LOGIN_PATH, { next: pathname + search });
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

  if (isAlwaysPublic(pathname) || role === "admin" || localPreview()) return response;

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

/**
 * Llave SOLO PARA PROBAR EN LOCAL: con STORE_PREVIEW_LOCAL=1 en .env.local,
 * `npm run dev` muestra la tienda real a cualquiera (por ejemplo, a una cuenta
 * de cliente de prueba) aunque no esté lanzada.
 * En Vercel (y en `npm run build` / `start`) NODE_ENV es "production", así que
 * esta llave nunca tiene efecto ahí: el modo construcción sigue igual.
 */
function localPreview(): boolean {
  return process.env.NODE_ENV === "development" && process.env.STORE_PREVIEW_LOCAL === "1";
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
    // y el contador de visitas (api/visita: sin sesión ni modo construcción, lo más liviano posible)
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|apple-icon|brand/|fonts/|api/visita|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
  ],
};
