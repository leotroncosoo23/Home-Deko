import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/**
 * Cliente de Supabase SIN sesión (como un visitante anónimo), para leer
 * datos públicos dentro de funciones con "use cache".
 *
 * ¿Por qué no el de server.ts? Ese lee las cookies del usuario, y una
 * función cacheada no puede leer cookies: el resultado es el mismo para
 * todos los visitantes. Solo ve lo que el RLS deja ver a "anon".
 */
export function createPublicClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
