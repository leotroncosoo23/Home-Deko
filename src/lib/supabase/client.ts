import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";

/**
 * Cliente de Supabase para usar en Componentes de Cliente ("use client").
 *
 * Usa la clave publishable (pública): todo lo que puede hacer está limitado
 * por las reglas RLS de la base. La sesión se guarda en cookies, así el
 * servidor también puede leerla.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
