import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { requireEnv } from "@/lib/env";

/**
 * Cliente de Supabase con la CLAVE SECRETA (rol service_role): saltea el RLS.
 *
 * Usarlo SOLO en el servidor y solo para lo que un visitante no puede hacer
 * por sí mismo: crear pedidos (create_order), confirmar pagos desde el
 * webhook (apply_order_payment) y leer el pedido de un invitado después de
 * verificar su link secreto. Nunca para leer datos "por comodidad".
 *
 * "server-only" hace que el build falle si alguien lo importa desde un
 * componente de cliente.
 */
export function createAdminClient() {
  return createClient<Database>(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SECRET_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
