import "server-only";
import { requireAdmin } from "@/lib/auth";
import { mapStoreSettings, STORE_SETTINGS_COLUMNS } from "@/lib/store-settings";
import { createClient } from "@/lib/supabase/server";
import type { AdminSettings } from "./types";

/**
 * La configuración para el panel, SIN caché (siempre el dato del momento,
 * por si el otro dueño la cambió). Arranca con requireAdmin().
 *
 * Llamarla dentro de <Suspense> (lee la sesión del usuario).
 */
export async function getSettingsForAdmin(): Promise<AdminSettings> {
  await requireAdmin();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("store_settings")
    .select(STORE_SETTINGS_COLUMNS)
    .single();
  if (error || !data) throw new Error("No se pudo cargar la configuración.");

  // El panel no necesita el id (se busca la fila en el servidor al guardar).
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id, ...settings } = mapStoreSettings(data);
  return settings;
}
