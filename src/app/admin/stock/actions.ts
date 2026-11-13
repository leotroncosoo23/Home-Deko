"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { normalizeSearch } from "../productos/list-params";
import { toVariantStock } from "./data";
import { ADJUST_REASONS } from "./reasons";
import { variantFullName, type AdjustResult, type VariantStock } from "./types";

/**
 * Server Actions de Stock. Todo cambio de stock pasa por la base:
 *   - ingreso, venta, rotura, devolución → adjust_stock (suma o resta)
 *   - corrección → count_stock (la base calcula la diferencia con el
 *     stock real en ese momento)
 */

const VARIANT_COLUMNS =
  "variant_id, product_id, product_name, variant_label, sku, barcode, stock, min_stock, stock_status, image_path";

const adjustSchema = z.object({
  variantId: z.uuid(),
  reason: z.enum(ADJUST_REASONS.map((r) => r.reason) as [string, ...string[]]),
  /** Cantidad que entra o sale (o el stock contado, si es corrección). */
  amount: z.number().int("Tiene que ser un número entero.").min(0).max(1_000_000, "El número es demasiado grande."),
  note: z.string().trim().max(300, "La nota puede tener hasta 300 caracteres.").nullable(),
});

export async function adjustVariantStock(raw: unknown): Promise<AdjustResult> {
  await requireAdmin();
  const parsed = adjustSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  const { variantId, reason, amount, note } = parsed.data;
  const info = ADJUST_REASONS.find((r) => r.reason === reason)!;
  if (info.sign !== 0 && amount === 0) return { ok: false, error: "Escribí una cantidad mayor a 0." };

  const supabase = await createClient();

  // Nombre de la variante para el aviso ("Taza — Rojo / 300 ml: 10 → 15")
  const { data: variant } = await supabase
    .from("admin_variant_stock")
    .select("product_name, variant_label")
    .eq("variant_id", variantId)
    .maybeSingle();
  const name = variant
    ? variantFullName({ productName: variant.product_name ?? "", variantLabel: variant.variant_label })
    : "Variante";

  if (info.sign === 0) {
    // Corrección: "hay N"
    const { data, error } = await supabase.rpc("count_stock", {
      p_variant_id: variantId,
      p_counted: amount,
      p_note: note || undefined,
    });
    if (error) return { ok: false, error: translate(error) };
    const result = data as { previous: number; new: number; difference: number };
    refresh();
    if (result.difference === 0) {
      return { ok: true, message: `${name}: el stock ya era ${result.new}. No se registró nada.`, newStock: result.new };
    }
    return { ok: true, message: `${name}: ${result.previous} → ${result.new}`, newStock: result.new };
  }

  const { data: newStock, error } = await supabase.rpc("adjust_stock", {
    p_variant_id: variantId,
    p_quantity: info.sign * amount,
    p_reason: reason as (typeof ADJUST_REASONS)[number]["reason"],
    p_note: note || undefined,
  });
  if (error) return { ok: false, error: translate(error) };
  refresh();
  const previous = newStock - info.sign * amount;
  return { ok: true, message: `${name}: ${previous} → ${newStock}`, newStock };
}

function translate(error: { code: string; message: string }): string {
  if (error.message.startsWith("Stock insuficiente")) {
    const hay = error.message.match(/hay (\d+)/)?.[1];
    return hay ? `No hay tanto stock: quedan ${hay}.` : "No hay tanto stock.";
  }
  if (error.code === "42501") return "Tu cuenta no tiene permiso para ajustar stock.";
  if (error.code === "HD404" || error.message.includes("no existe")) return "Esta variante ya no existe. Recargá la página.";
  if (error.code === "HD422") return error.message;
  return "No se pudo registrar el ajuste. Intentá de nuevo en unos segundos.";
}

/**
 * Variantes de un producto con su stock ACTUAL (para el diálogo "Ajustar
 * stock"). Los productos archivados no aparecen (primero hay que desarchivar).
 */
export async function getProductVariantsForStock(productId: string): Promise<VariantStock[]> {
  await requireAdmin();
  if (!/^[0-9a-f-]{36}$/i.test(productId)) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("admin_variant_stock")
    .select(VARIANT_COLUMNS)
    .eq("product_id", productId)
    .order("position");
  if (error) throw new Error("No se pudieron cargar las variantes.");
  return data.map(toVariantStock);
}

/**
 * Buscar variantes (ingreso rápido). Si el texto es un código de barras o
 * SKU EXACTO, viene en "exact" (el lector USB elige directo).
 */
export async function searchVariants(text: string): Promise<{ exact: VariantStock | null; results: VariantStock[] }> {
  await requireAdmin();
  const clean = typeof text === "string" ? text.trim().slice(0, 100) : "";
  if (!clean) return { exact: null, results: [] };
  const supabase = await createClient();

  let exact: VariantStock | null = null;
  if (/^[A-Za-z0-9._-]{3,60}$/.test(clean)) {
    const { data } = await supabase
      .from("admin_variant_stock")
      .select(VARIANT_COLUMNS)
      .or(`barcode.eq.${clean},sku.eq.${clean.toUpperCase()}`)
      .limit(2);
    if (data && data.length === 1) exact = toVariantStock(data[0]);
  }

  let query = supabase.from("admin_variant_stock").select(VARIANT_COLUMNS);
  for (const word of normalizeSearch(clean).split(" ").filter(Boolean).slice(0, 6)) {
    query = query.ilike("search_text", `%${word}%`);
  }
  const { data } = await query.order("product_name").order("position").limit(8);
  return { exact, results: (data ?? []).map(toVariantStock) };
}
