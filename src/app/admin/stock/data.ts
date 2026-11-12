import "server-only";
import { cache } from "react";
import { getCurrentUser, requireAdmin } from "@/lib/auth";
import { publicImageUrl } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";
import { dayEndToIso, dayStartToIso } from "../productos/form-state";
import { normalizeSearch } from "../productos/list-params";
import { HISTORY_PAGE_SIZE, type HistoryParams, type RestockFilter } from "./history-params";
import type { StockReason } from "./reasons";
import type { Movement, MovementsPage, VariantStock } from "./types";

/**
 * Lecturas de Stock. Todas con requireAdmin() (salvo el contador de la
 * barra lateral, que si no es admin simplemente devuelve 0) y dentro de
 * <Suspense>.
 */

const VARIANT_COLUMNS =
  "variant_id, product_id, product_name, variant_label, sku, barcode, stock, min_stock, stock_status, image_path";

type VariantRow = {
  variant_id: string | null;
  product_id: string | null;
  product_name: string | null;
  variant_label: string | null;
  sku: string | null;
  barcode: string | null;
  stock: number | null;
  min_stock: number | null;
  stock_status: string | null;
  image_path: string | null;
};

/** Fila de la vista → VariantStock (las columnas de una vista llegan "nullables"). */
export function toVariantStock(r: VariantRow): VariantStock {
  return {
    variantId: r.variant_id ?? "",
    productId: r.product_id ?? "",
    productName: r.product_name ?? "",
    variantLabel: r.variant_label,
    sku: r.sku,
    barcode: r.barcode ?? "",
    stock: r.stock ?? 0,
    minStock: r.min_stock ?? 0,
    stockStatus: (r.stock_status ?? "ok") as VariantStock["stockStatus"],
    imageUrl: r.image_path ? publicImageUrl(r.image_path) : null,
  };
}

// ---------------------------------------------------------------------
// Para reponer: sin stock primero, después stock bajo (menos stock arriba)
// ---------------------------------------------------------------------
export const RESTOCK_LIMIT = 50;

export async function getRestockList(filter: RestockFilter): Promise<{ items: VariantStock[]; total: number }> {
  await requireAdmin();
  const supabase = await createClient();
  let query = supabase.from("admin_variant_stock").select(VARIANT_COLUMNS, { count: "exact" });
  query = filter === "sin" ? query.eq("stock_status", "out")
    : filter === "bajo" ? query.eq("stock_status", "low")
    : query.in("stock_status", ["out", "low"]);
  const { data, count, error } = await query
    .order("stock")
    .order("product_name")
    .order("position")
    .limit(RESTOCK_LIMIT);
  if (error) throw new Error("No se pudo cargar la lista para reponer.");
  return { items: data.map(toVariantStock), total: count ?? 0 };
}

/**
 * Cuántas variantes hay para reponer (contador de la barra lateral).
 * cache(): si en un mismo pedido lo piden la barra fija y la del celular,
 * se consulta una sola vez. Si no es admin, 0 (nunca rompe el layout).
 */
export const getRestockCount = cache(async (): Promise<number> => {
  const user = await getCurrentUser();
  if (!user?.isAdmin) return 0;
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("admin_variant_stock")
    .select("variant_id", { count: "exact", head: true })
    .in("stock_status", ["out", "low"]);
  return error ? 0 : (count ?? 0);
});

// ---------------------------------------------------------------------
// Historial
// ---------------------------------------------------------------------
const MOVEMENT_COLUMNS =
  "id, created_at, product_id, product_name, variant_label, reason, quantity, stock_after, note, author_name";

type MovementRow = {
  id: string | null;
  created_at: string | null;
  product_id: string | null;
  product_name: string | null;
  variant_label: string | null;
  reason: StockReason | null;
  quantity: number | null;
  stock_after: number | null;
  note: string | null;
  author_name: string | null;
};

function toMovement(r: MovementRow): Movement {
  return {
    id: r.id ?? "",
    createdAt: r.created_at ?? "",
    productId: r.product_id ?? "",
    productName: r.product_name ?? "",
    variantLabel: r.variant_label,
    reason: r.reason ?? "ajuste",
    quantity: r.quantity ?? 0,
    stockAfter: r.stock_after ?? 0,
    note: r.note,
    authorName: r.author_name,
  };
}

/** Historial general con filtros (fechas en hora de Argentina) y paginación. */
export async function getMovements(params: HistoryParams): Promise<MovementsPage> {
  await requireAdmin();
  const supabase = await createClient();

  const filtered = (countOnly: boolean) => {
    let q = supabase.from("admin_stock_movements").select(MOVEMENT_COLUMNS, { count: "exact", head: countOnly });
    const from = dayStartToIso(params.desde);
    const to = dayEndToIso(params.hasta);
    if (from) q = q.gte("created_at", from);
    if (to) q = q.lte("created_at", to);
    if (params.motivo) q = q.eq("reason", params.motivo);
    if (params.pid) q = q.eq("product_id", params.pid);
    for (const word of normalizeSearch(params.q).split(" ").filter(Boolean).slice(0, 6)) {
      q = q.ilike("search_text", `%${word}%`);
    }
    return q;
  };
  const run = (page: number) =>
    filtered(false)
      .order("created_at", { ascending: false })
      .order("id")
      .range((page - 1) * HISTORY_PAGE_SIZE, page * HISTORY_PAGE_SIZE - 1);

  let page = params.pagina;
  let { data, count, error } = await run(page);
  // Página que no existe (PGRST103): mostrar la última que sí existe.
  if (error?.code === "PGRST103" && page > 1) {
    const { count: total } = await filtered(true);
    page = Math.max(1, Math.ceil((total ?? 0) / HISTORY_PAGE_SIZE));
    ({ data, count, error } = await run(page));
  }
  if (error || !data) throw new Error("No se pudo cargar el historial.");

  const total = count ?? 0;
  return { items: data.map(toMovement), total, page, pageCount: Math.max(1, Math.ceil(total / HISTORY_PAGE_SIZE)) };
}

/** Últimos movimientos de un producto (para la edición). */
export async function getProductMovements(productId: string, limit = 20): Promise<{ items: Movement[]; total: number }> {
  await requireAdmin();
  const supabase = await createClient();
  const { data, count, error } = await supabase
    .from("admin_stock_movements")
    .select(MOVEMENT_COLUMNS, { count: "exact" })
    .eq("product_id", productId)
    .order("created_at", { ascending: false })
    .order("id")
    .limit(limit);
  if (error) throw new Error("No se pudo cargar el historial del producto.");
  return { items: data.map(toMovement), total: count ?? 0 };
}

/** Nombre de un producto (para el filtro "Producto: Taza"). */
export async function getProductName(productId: string): Promise<string | null> {
  await requireAdmin();
  const supabase = await createClient();
  const { data } = await supabase.from("products").select("name").eq("id", productId).maybeSingle();
  return data?.name ?? null;
}
