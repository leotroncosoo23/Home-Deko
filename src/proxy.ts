import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

/**
 * Proxy (antes llamado "middleware"): corre ANTES de cada página.
 *
 * 1. Renueva la sesión de Supabase (si el token venció, pide uno nuevo).
 * 2. Si alguien sin sesión entra a /admin, lo manda a /login.
 *
 * Esto es solo un filtro rápido. Que el usuario sea ADMIN se controla en
 * src/app/admin/layout.tsx, y la base además lo protege con RLS.
 */
export async function proxy(request: NextRequest) {
  const { response, hasSession } = await updateSession(request);
  const { pathname, search } = request.nextUrl;

  if (!hasSession && pathname.startsWith("/admin")) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    loginUrl.searchParams.set("next", pathname + search);
    const redirect = NextResponse.redirect(loginUrl);
    // Copiar cookies renovadas/borradas a la redirección
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }

  return response;
}

export const config = {
  matcher: [
    // Todas las rutas menos archivos estáticos e imágenes
    "/((?!_next/static|_next/image|favicon.ico|brand/|fonts/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
  ],
};
