"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { MAX_PER_VARIANT, MAX_TOTAL_LABELS, type LabelActionResult, type LabelVariantChoice } from "./types";

/**
 * Server Actions de la cola de etiquetas. Todas:
 *   - verifican que sea admin (y además la base tiene RLS),
 *   - validan lo que llega del navegador,
 *   - terminan con refresh() para que se actualice el contador de la barra.
 */

const GENERIC_ERROR = "No se pudo actualizar la cola de etiquetas. Intentá de nuevo en unos segundos.";
const MAX_PRODUCTS = 200; // igual que las acciones masivas del listado

const plural = (n: number, one: string, many: string) => (n === 1 ? `1 ${one}` : `${n} ${many}`);

// ---------------------------------------------------------------------
// Para el diálogo "Agregar a etiquetas"
// ---------------------------------------------------------------------

/**
 * Variantes de uno o varios productos, con su stock ACTUAL (la cantidad
 * sugerida) y cuántas etiquetas tienen ya en la cola.
 * Los productos archivados no aparecen.
 */
export async function getVariantsForLabels(rawProductIds: string[]): Promise<LabelVariantChoice[]> {
  await requireAdmin();
  const parsed = z.array(z.uuid()).min(1).max(MAX_PRODUCTS).safeParse(rawProductIds);
  if (!parsed.success) return [];
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("admin_variant_stock")
    .select("variant_id, product_id, product_name, variant_label, barcode, stock")
    .in("product_id", [...new Set(parsed.data)])
    .order("product_name")
    .order("position");
  if (error) throw new Error("No se pudieron cargar las variantes.");

  const ids = data.map((v) => v.variant_id ?? "");
  const queued = new Map<string, number>();
  if (ids.length > 0) {
    const { data: rows } = await supabase.from("label_queue").select("variant_id, quantity").in("variant_id", ids);
    for (const r of rows ?? []) queued.set(r.variant_id, r.quantity);
  }

  return data.map((v) => ({
    variantId: v.variant_id ?? "",
    productId: v.product_id ?? "",
    productName: v.product_name ?? "",
    variantLabel: v.variant_label,
    barcode: v.barcode ?? "",
    stock: v.stock ?? 0,
    queued: queued.get(v.variant_id ?? "") ?? 0,
  }));
}

// ---------------------------------------------------------------------
// Agregar / cambiar / quitar
// ---------------------------------------------------------------------

const quantitySchema = z
  .number()
  .int("La cantidad tiene que ser un número entero.")
  .min(1, "La cantidad mínima es 1.")
  .max(MAX_PER_VARIANT, `Hasta ${MAX_PER_VARIANT} etiquetas por variante.`);

const addSchema = z
  .array(z.object({ variantId: z.uuid(), quantity: quantitySchema }))
  .min(1, "Elegí al menos una variante.")
  .max(2000);

/**
 * Agrega variantes a la cola. Si una ya estaba, su cantidad se REEMPLAZA
 * por la nueva (no se suma): así no se imprimen etiquetas de más.
 */
export async function addToLabelQueue(raw: unknown): Promise<LabelActionResult> {
  await requireAdmin();
  const parsed = addSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  // Si la misma variante vino dos veces, vale la última
  const items = [...new Map(parsed.data.map((i) => [i.variantId, i])).values()];

  const supabase = await createClient();
  const limitError = await checkTotal(supabase, items);
  if (limitError) return { ok: false, error: limitError };

  const { error } = await supabase
    .from("label_queue")
    .upsert(items.map((i) => ({ variant_id: i.variantId, quantity: i.quantity })), { onConflict: "variant_id" });
  if (error) return { ok: false, error: translate(error) };

  refresh();
  const labels = items.reduce((s, i) => s + i.quantity, 0);
  return { ok: true, message: `${plural(labels, "etiqueta", "etiquetas")} en la cola.` };
}

/** Cambia cuántas etiquetas se imprimen de una variante. */
export async function setLabelQuantity(variantId: string, quantity: number): Promise<LabelActionResult> {
  await requireAdmin();
  const parsed = z.object({ variantId: z.uuid(), quantity: quantitySchema }).safeParse({ variantId, quantity });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };

  const supabase = await createClient();
  const limitError = await checkTotal(supabase, [parsed.data]);
  if (limitError) return { ok: false, error: limitError };

  const { data, error } = await supabase
    .from("label_queue")
    .update({ quantity: parsed.data.quantity })
    .eq("variant_id", parsed.data.variantId)
    .select("variant_id");
  if (error) return { ok: false, error: translate(error) };
  if (data.length === 0) return { ok: false, error: "Esa variante ya no está en la cola. Recargá la página." };

  refresh();
  return { ok: true, message: "Cantidad actualizada." };
}

/** Saca una variante de la cola. */
export async function removeFromLabelQueue(variantId: string): Promise<LabelActionResult> {
  await requireAdmin();
  if (!z.uuid().safeParse(variantId).success) return { ok: false, error: "Variante inválida. Recargá la página." };
  const supabase = await createClient();
  const { error } = await supabase.from("label_queue").delete().eq("variant_id", variantId);
  if (error) return { ok: false, error: translate(error) };
  refresh();
  return { ok: true, message: "Quitada de la cola." };
}

/** Vacía la cola entera (después de imprimir, por ejemplo). */
export async function clearLabelQueue(): Promise<LabelActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  // .not(...is null) = "todas las filas" (Supabase no deja borrar sin filtro)
  const { error } = await supabase.from("label_queue").delete().not("variant_id", "is", null);
  if (error) return { ok: false, error: translate(error) };
  refresh();
  return { ok: true, message: "La cola quedó vacía." };
}

// ---------------------------------------------------------------------
// Ayudas
// ---------------------------------------------------------------------

/** ¿Con estos cambios la cola pasaría el tope total? */
async function checkTotal(
  supabase: Awaited<ReturnType<typeof createClient>>,
  changes: { variantId: string; quantity: number }[],
): Promise<string | null> {
  const { data, error } = await supabase.from("label_queue").select("variant_id, quantity");
  if (error) return GENERIC_ERROR;
  const changed = new Set(changes.map((c) => c.variantId));
  const others = data.filter((r) => !changed.has(r.variant_id)).reduce((s, r) => s + r.quantity, 0);
  const total = others + changes.reduce((s, c) => s + c.quantity, 0);
  if (total > MAX_TOTAL_LABELS) {
    return `La cola puede tener hasta ${MAX_TOTAL_LABELS} etiquetas (${Math.ceil(MAX_TOTAL_LABELS / 40)} hojas). Imprimí y vaciá la cola antes de agregar más.`;
  }
  return null;
}

function translate(error: { code: string }): string {
  if (error.code === "42501") return "Tu cuenta no tiene permiso para usar la cola de etiquetas.";
  if (error.code === "23503") return "Alguna de esas variantes ya no existe. Recargá la página.";
  if (error.code === "23514") return `La cantidad tiene que ser entre 1 y ${MAX_PER_VARIANT}.`;
  return GENERIC_ERROR;
}
