import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/redirects";

/**
 * /auth/callback
 *
 * Acá vuelve el usuario después de:
 *   - elegir su cuenta en Google, o
 *   - hacer clic en el link de confirmación del email.
 *
 * Llega con ?code=..., un código de un solo uso que se cambia por una
 * sesión (cookies). Después se lo manda a ?next= (por defecto /admin).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    console.error("Error en /auth/callback:", error.code, error.message);
  }

  // Sin código, código vencido, o el usuario canceló en Google
  return NextResponse.redirect(`${origin}/login?error=callback`);
}
