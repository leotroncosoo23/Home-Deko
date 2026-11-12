import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";
import type { Database } from "@/lib/database.types";

/**
 * Cliente de Supabase para el servidor: Server Components, Server Actions
 * y Route Handlers.
 *
 * Crear uno nuevo en cada uso (no guardarlo en una variable global): cada
 * pedido tiene sus propias cookies, o sea, su propio usuario.
 */
export async function createClient() {
  // connection(): le avisa a Next que lo que sigue depende del pedido real
  // del usuario. Sin esto, Next intenta pre-armar la página por adelantado
  // y se queja porque Supabase usa la hora actual (Date.now) para saber si
  // la sesión venció. Fuera de ese pre-armado no hace nada.
  await connection();
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Un Server Component no puede escribir cookies (solo las
            // Server Actions y los Route Handlers). No pasa nada: el
            // proxy (src/proxy.ts) ya renueva la sesión en cada pedido.
          }
        },
      },
    },
  );
}
