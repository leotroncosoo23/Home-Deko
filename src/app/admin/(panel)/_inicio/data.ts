import "server-only";
import { requireAdmin } from "@/lib/auth";
import { BUCKET_SQL, type Period } from "@/lib/dashboard-period";
import { titleCase } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { VISIT_SOURCES, type VisitSource } from "@/lib/visit-source";
import type { OrderRow } from "../pedidos/data";

/**
 * Lecturas del Inicio del panel. Todo se calcula en la base
 * (20261202000001_inicio_panel.sql), con la sesión del admin:
 *   - admin_home_attention() → "Requiere atención"
 *   - admin_dashboard(…)     → tarjetas, gráfico, más vendidos y visitas
 * Ventas = pedidos web aprobados y no cancelados, por fecha de pago en Argentina.
 */

// ---------------------------------------------------------------------------
// Requiere atención
// ---------------------------------------------------------------------------

export type Attention = {
  toPrepare: number;
  stockIssue: number;
  needsReview: number;
  lowStock: number;
  outOfStock: number;
  /** Solicitudes nuevas del Botón de arrepentimiento. */
  pendingWithdrawals: number;
  /** Datos del comercio que faltan en Configuración, en el orden en que se nombran. */
  missingSettings: string[];
};

export async function getAttention(): Promise<Attention> {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_home_attention").single();
  if (error || !data) throw new Error("No se pudo leer lo que requiere atención.");

  const missing: string[] = [];
  if (data.missing_email) missing.push("email del negocio");
  if (data.missing_whatsapp) missing.push("WhatsApp");
  if (data.missing_business_name) missing.push("razón social");
  if (data.missing_cuit) missing.push("CUIT");

  return {
    toPrepare: Number(data.to_prepare),
    stockIssue: Number(data.stock_issue),
    needsReview: Number(data.needs_review),
    lowStock: Number(data.low_stock),
    outOfStock: Number(data.out_of_stock),
    pendingWithdrawals: Number(data.pending_withdrawals),
    missingSettings: missing,
  };
}

// ---------------------------------------------------------------------------
// Ventas y visitas de un período
// ---------------------------------------------------------------------------

export type Totals = { sales: number; orders: number; shipping: number; discounts: number; visits: number };
export type SeriesPoint = { start: string; sales: number; orders: number };
export type TopProduct = { productId: string | null; name: string; imagePath: string | null; units: number; revenue: number };
export type SourceRow = { source: VisitSource; visits: number };
export type ViewedProduct = { productId: string; name: string; imagePath: string | null; views: number; units: number };

export type Dashboard = {
  launched: boolean;
  current: Totals;
  previous: Totals;
  series: SeriesPoint[];
  topProducts: TopProduct[];
  sources: SourceRow[];
  topViewed: ViewedProduct[];
};

/** Lo que devuelve admin_dashboard (jsonb: los números pueden venir como texto). */
type RawDashboard = {
  launched?: boolean;
  current?: Record<string, unknown>;
  previous?: Record<string, unknown>;
  series?: { start: string; sales: unknown; orders: unknown }[];
  top_products?: { product_id: string | null; name: string; image_path: string | null; units: unknown; revenue: unknown }[];
  sources?: { source: string; visits: unknown }[];
  top_viewed?: { product_id: string; name: string; image_path: string | null; views: unknown; units: unknown }[];
};

const num = (v: unknown) => Number(v ?? 0) || 0;

function totals(raw: Record<string, unknown> | undefined): Totals {
  return {
    sales: num(raw?.sales),
    orders: num(raw?.orders),
    shipping: num(raw?.shipping),
    discounts: num(raw?.discounts),
    visits: num(raw?.visits),
  };
}

export async function getDashboard(period: Period): Promise<Dashboard> {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_dashboard", {
    p_from: period.from,
    p_to: period.to,
    p_prev_from: period.prevFrom,
    p_prev_to: period.prevTo,
    // Un solo día no tiene gráfico: se pide por día igual (1 tramo)
    p_bucket: BUCKET_SQL[period.bucket],
  });
  if (error || !data) throw new Error("No se pudieron leer las ventas.");
  const raw = data as RawDashboard;

  return {
    launched: raw.launched === true,
    current: totals(raw.current),
    previous: totals(raw.previous),
    series: (raw.series ?? []).map((p) => ({ start: p.start, sales: num(p.sales), orders: num(p.orders) })),
    topProducts: (raw.top_products ?? []).map((p) => ({
      productId: p.product_id,
      name: p.name,
      imagePath: p.image_path,
      units: num(p.units),
      revenue: num(p.revenue),
    })),
    sources: (raw.sources ?? [])
      .filter((s): s is { source: VisitSource; visits: unknown } => (VISIT_SOURCES as readonly string[]).includes(s.source))
      .map((s) => ({ source: s.source, visits: num(s.visits) })),
    topViewed: (raw.top_viewed ?? []).map((p) => ({
      productId: p.product_id,
      name: p.name,
      imagePath: p.image_path,
      views: num(p.views),
      units: num(p.units),
    })),
  };
}

// ---------------------------------------------------------------------------
// Últimos pedidos (los mismos que la pestaña "Todos": cobrados, cancelados y
// para revisar; sin los intentos que quedaron sin pagar)
// ---------------------------------------------------------------------------

export type LatestOrder = Pick<
  OrderRow,
  "id" | "number" | "createdAt" | "customerName" | "delivery" | "total" | "paymentStatus" | "fulfillmentStatus" | "stockIssue" | "needsReview"
>;

export async function getLatestOrders(limit = 5): Promise<LatestOrder[]> {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select("id, order_number, created_at, customer_name, delivery_method, total, payment_status, fulfillment_status, stock_issue, needs_review")
    .or("payment_status.eq.approved,needs_review.eq.true,fulfillment_status.eq.cancelled")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error("No se pudieron leer los últimos pedidos.");

  return data.map((o) => ({
    id: o.id,
    number: o.order_number,
    createdAt: o.created_at,
    customerName: titleCase(o.customer_name),
    delivery: o.delivery_method,
    total: Number(o.total),
    paymentStatus: o.payment_status,
    fulfillmentStatus: o.fulfillment_status,
    stockIssue: o.stock_issue,
    needsReview: o.needs_review,
  }));
}
