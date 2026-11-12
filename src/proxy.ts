import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

/**
 * Proxy (antes llamado "middleware"): corre ANTES de cada página.
 *
 * 1. Renueva la sesión de Supabase (si el token venció, pide uno nuevo).
 * 2. Protege /admin leyendo el token, sin consultar la base:
 *      sin sesión          → /login?next=...
 *      con sesión, sin rol → /sin-acceso
 *
 * Esto decide a dónde va el usuario. Los DATOS se protegen además con
 * requireAdmin() (src/lib/auth.ts, lee el rol de la base en el momento)
 * y con RLS en la base. Por eso no importa que el rol del token pueda
 * tener hasta ~1 hora de atraso.
 */
export async function proxy(request: NextRequest) {
  const { response, hasSession, role } = await updateSession(request);
  const { pathname, search } = request.nextUrl;

  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    if (!hasSession) {
      return redirectWithCookies(request, response, "/login", { next: pathname + search });
    }
    if (role !== "admin") {
      return redirectWithCookies(request, response, "/sin-acceso");
    }
  }

  return response;
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
    // Todas las rutas menos archivos estáticos e imágenes
    "/((?!_next/static|_next/image|favicon.ico|brand/|fonts/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
  ],
};
