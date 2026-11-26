"use server";

import { refresh, updateTag } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { mapStoreSettings, STORE_SETTINGS_COLUMNS, STORE_SETTINGS_TAG } from "@/lib/store-settings";
import type { TablesUpdate } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";
import { missingForLaunch, SETTINGS_FIELDS, validateSettings, type SettingsInput } from "./schema";
import type { ActionResult } from "./types";

/**
 * Server Actions de Configuración.
 *
 * Reglas para TODAS:
 *   1. Arrancan con requireAdmin() (rol leído de la base en el momento).
 *   2. No confían en el navegador: vuelven a validar todo acá.
 *   3. updateTag(STORE_SETTINGS_TAG): borra la configuración cacheada, así
 *      la página "Muy pronto", el pie y las páginas legales muestran el
 *      dato nuevo en el próximo pedido.
 *   4. refresh(): vuelve a pedir la página del panel con los datos nuevos.
 * Por debajo, el RLS solo deja editar a los admins.
 */

const GENERIC_ERROR = "No se pudo guardar. Intentá de nuevo en unos segundos.";

/**
 * Actualiza la única fila de store_settings.
 * El filtro "id no es null" es solo para que el UPDATE tenga un WHERE
 * (la tabla tiene una sola fila, garantizado por la base).
 */
async function updateSettings(values: TablesUpdate<"store_settings">): Promise<ActionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("store_settings")
    .update(values)
    .not("id", "is", null)
    .select("id");

  // 0 filas = el RLS no lo dejó (no debería pasar: ya pasó requireAdmin).
  if (error || data.length === 0) return { ok: false, error: GENERIC_ERROR };

  updateTag(STORE_SETTINGS_TAG);
  refresh();
  return { ok: true };
}

/** La fila guardada en la base, en el momento (sin caché). */
async function readSavedSettings() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("store_settings").select(STORE_SETTINGS_COLUMNS).single();
  return error || !data ? null : mapStoreSettings(data);
}

/**
 * Prende o apaga la tienda (el modo construcción).
 * Para PRENDERLA revisa los datos GUARDADOS (no lo que esté escrito sin
 * guardar en el formulario): si falta alguno obligatorio, no la lanza y
 * dice cuáles faltan. Apagarla se puede siempre.
 */
export async function setStoreLaunched(launched: boolean): Promise<ActionResult> {
  await requireAdmin();
  if (typeof launched !== "boolean") return { ok: false, error: "Valor inválido." };

  if (launched) {
    const saved = await readSavedSettings();
    if (!saved) return { ok: false, error: GENERIC_ERROR };
    const missing = missingForLaunch(saved);
    if (missing.length > 0) {
      return {
        ok: false,
        error: `Para lanzar la tienda falta completar: ${missing.map((m) => m.label).join(", ")}.`,
      };
    }
  }
  return updateSettings({ is_launched: launched });
}

/** Guarda redes, envío, local, datos del comercio y precios. */
export async function saveStoreSettings(formData: FormData): Promise<ActionResult> {
  await requireAdmin();

  const input = Object.fromEntries(
    SETTINGS_FIELDS.map((field) => [field, String(formData.get(field) ?? "")]),
  ) as SettingsInput;

  // Con la tienda lanzada, los datos obligatorios no se pueden borrar.
  const saved = await readSavedSettings();
  if (!saved) return { ok: false, error: GENERIC_ERROR };
  const result = validateSettings(input, { isLaunched: saved.isLaunched });
  if (!result.ok) {
    return { ok: false, error: "Revisá los datos marcados.", fieldErrors: result.fieldErrors };
  }

  const v = result.data;
  return updateSettings({
    whatsapp: v.whatsapp,
    instagram: v.instagram,
    tiktok: v.tiktok,
    shipping_cost: v.shippingCost,
    dispatch_time: v.dispatchTime,
    store_address: v.storeAddress,
    store_hours: v.storeHours,
    exchange_days: v.exchangeDays,
    business_name: v.businessName,
    cuit: v.cuit,
    contact_email: v.contactEmail,
    show_price_without_taxes: v.showPriceWithoutTaxes,
    national_tax_percent: v.nationalTaxPercent,
    cash_discount_percent: v.cashDiscountPercent,
    installments_enabled: v.installmentsEnabled,
    installments_max: v.installmentsMax,
  });
}
