import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/database.types";

/**
 * Renueva la sesión de Supabase en cada pedido y devuelve:
 *   - response: la respuesta con las cookies de sesión actualizadas.
 *   - hasSession: si hay un usuario logueado (chequeo rápido).
 *
 * Lo usa src/proxy.ts. Es un chequeo "optimista": sirve para redirigir
 * rápido, pero el control de verdad (rol admin) está en src/app/admin/layout.tsx.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          // 1) Pasar las cookies nuevas al pedido, para que la página que
          //    se está por mostrar ya vea la sesión renovada.
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          // 2) Y a la respuesta, para que el navegador las guarde.
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          // 3) Encabezados que pide Supabase (ej.: no cachear respuestas
          //    que traen cookies de sesión).
          Object.entries(headers ?? {}).forEach(([key, value]) =>
            response.headers.set(key, value),
          );
        },
      },
    },
  );

  // IMPORTANTE: no poner código entre createServerClient y getClaims().
  // getClaims() verifica la firma del token y, si venció, lo renueva.
  const { data } = await supabase.auth.getClaims();

  return { response, hasSession: Boolean(data?.claims) };
}
