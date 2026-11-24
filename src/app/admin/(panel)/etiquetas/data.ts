import "server-only";
import { cache } from "react";
import { getCurrentUser, requireAdmin } from "@/lib/auth";
import { publicImageUrl } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";
import type { LabelQueueItem } from "./types";

/**
 * Lecturas de Etiquetas. Con requireAdmin() (salvo el contador de la barra
 * lateral, que si no es admin devuelve 0) y dentro de <Suspense>.
 */

/** La cola completa, ordenada por producto y por variante. */
export async function getLabelQueue(): Promise<LabelQueueItem[]> {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("admin_label_queue")
    .select("variant_id, product_id, product_name, variant_label, sku, barcode, stock, quantity, image_path")
    .order("product_name")
    .order("position");
  if (error) throw new Error("No se pudo cargar la cola de etiquetas.");
  return data.map((r) => ({
    variantId: r.variant_id ?? "",
    productId: r.product_id ?? "",
    productName: r.product_name ?? "",
    variantLabel: r.variant_label,
    sku: r.sku,
    barcode: r.barcode ?? "",
    stock: r.stock ?? 0,
    quantity: r.quantity ?? 1,
    imageUrl: r.image_path ? publicImageUrl(r.image_path) : null,
  }));
}

/**
 * Cuántas etiquetas hay en la cola (contador de la barra lateral).
 * cache(): la barra fija y la del celular comparten una sola consulta.
 * Si no es admin, 0 (nunca rompe el layout).
 */
export const getLabelQueueCount = cache(async (): Promise<number> => {
  const user = await getCurrentUser();
  if (!user?.isAdmin) return 0;
  const supabase = await createClient();
  // La vista (no la tabla) para no contar variantes archivadas que no se imprimen
  const { data, error } = await supabase.from("admin_label_queue").select("quantity");
  if (error) return 0;
  return data.reduce((sum, r) => sum + (r.quantity ?? 0), 0);
});
