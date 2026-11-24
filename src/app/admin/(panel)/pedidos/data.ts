import "server-only";
import { cache } from "react";
import { trackingFor, type Tracking } from "@/lib/carriers";
import { getCurrentUser, requireAdmin } from "@/lib/auth";
import { titleCase } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { cleanSearch, PAGE_SIZE, searchNumber, type ListParams } from "./list-params";
import type { DeliveryMethod, FulfillmentStatus, OrderEventKind, PaymentStatus } from "./status";

/**
 * Lecturas de Pedidos (con la sesión del admin: el RLS deja ver todos los
 * pedidos solo a los admins).
 */

/**
 * "Requiere atención" (contador del menú) = cobrados que todavía no se
 * empezaron a preparar (incluye los "pagados sin stock") + los "para revisar".
 */
const ATTENTION_FILTER = "and(payment_status.eq.approved,fulfillment_status.eq.paid),needs_review.eq.true";

export type OrderRow = {
  id: string;
  number: number;
  createdAt: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  delivery: DeliveryMethod;
  place: string | null;
  total: number;
  units: number;
  paymentStatus: PaymentStatus;
  fulfillmentStatus: FulfillmentStatus;
  stockIssue: boolean;
  needsReview: boolean;
  reviewReason: string | null;
  tracking: Tracking | null;
};

export type OrdersPage = { items: OrderRow[]; total: number; page: number; pageCount: number };

const LIST_COLUMNS =
  "id, order_number, created_at, customer_name, customer_email, customer_phone, delivery_method, ship_city, ship_province, total, payment_status, fulfillment_status, stock_issue, needs_review, review_reason, carrier, carrier_name, tracking_code, tracking_url, order_items(quantity)";

export async function getOrders(params: ListParams): Promise<OrdersPage> {
  await requireAdmin();
  const supabase = await createClient();
  let query = supabase.from("orders").select(LIST_COLUMNS, { count: "exact" });
  // Condiciones "o" de la pestaña y de la búsqueda: se juntan en UN solo
  // filtro al final (dos filtros "or" sueltos no se combinan de forma segura).
  let tabOr: string | null = null;

  switch (params.estado) {
    case "preparar":
      query = query.eq("payment_status", "approved").eq("fulfillment_status", "paid");
      break;
    case "preparando":
      query = query.eq("payment_status", "approved").eq("fulfillment_status", "preparing");
      break;
    case "enviados":
      query = query.eq("payment_status", "approved").eq("fulfillment_status", "shipped");
      break;
    case "retirar":
      query = query.eq("payment_status", "approved").eq("fulfillment_status", "ready_for_pickup");
      break;
    case "listos":
      query = query.in("fulfillment_status", ["delivered", "picked_up"]);
      break;
    case "atencion":
      tabOr = "and(stock_issue.eq.true,fulfillment_status.neq.cancelled),needs_review.eq.true";
      break;
    case "todos":
      // Sin "sin pagar": los cobrados, los cancelados y los para revisar (los
      // intentos que quedaron sin pagar son la mayoría y no requieren nada).
      if (!params.sinPagar) tabOr = "payment_status.eq.approved,needs_review.eq.true,fulfillment_status.eq.cancelled";
      break;
  }

  if (params.entrega === "envio") query = query.eq("delivery_method", "shipping");
  if (params.entrega === "retiro") query = query.eq("delivery_method", "pickup");

  const number = searchNumber(params.q);
  const text = cleanSearch(params.q);
  // Comillas: el texto puede tener espacios ("juan perez")
  const searchOr = number === null && text ? `customer_name.ilike."%${text}%",customer_email.ilike."%${text}%"` : null;
  if (number !== null) query = query.eq("order_number", number);

  const orFilter = tabOr && searchOr ? `and(or(${tabOr}),or(${searchOr}))` : (tabOr ?? searchOr);
  if (orFilter) query = query.or(orFilter);

  // Lo que falta despachar, del más viejo al más nuevo (primero el que
  // espera hace más tiempo). Lo demás, del más nuevo al más viejo.
  const oldestFirst = params.estado === "preparar" || params.estado === "preparando" || params.estado === "retirar";
  const from = (params.pagina - 1) * PAGE_SIZE;
  const { data, count, error } = await query
    .order("created_at", { ascending: oldestFirst })
    .range(from, from + PAGE_SIZE - 1);
  if (error) throw new Error("No se pudieron leer los pedidos.");

  const total = count ?? data.length;
  return {
    total,
    page: params.pagina,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    items: data.map((o) => ({
      id: o.id,
      number: o.order_number,
      createdAt: o.created_at,
      // Mayúscula inicial solo para mostrar (lo guardado no cambia)
      customerName: titleCase(o.customer_name),
      customerEmail: o.customer_email,
      customerPhone: o.customer_phone,
      delivery: o.delivery_method,
      place: o.ship_city ? `${titleCase(o.ship_city)}, ${titleCase(o.ship_province)}` : null,
      total: Number(o.total),
      units: o.order_items.reduce((sum, i) => sum + i.quantity, 0),
      paymentStatus: o.payment_status,
      fulfillmentStatus: o.fulfillment_status,
      stockIssue: o.stock_issue,
      needsReview: o.needs_review,
      reviewReason: o.review_reason,
      tracking: trackingFor(o),
    })),
  };
}

export type OrderCounts = {
  preparar: number;
  preparando: number;
  enviados: number;
  retirar: number;
  listos: number;
  todos: number;
  stockIssue: number;
  needsReview: number;
};

export async function getOrderCounts(): Promise<OrderCounts> {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_order_counts").single();
  if (error || !data) throw new Error("No se pudieron contar los pedidos.");
  return {
    preparar: Number(data.to_prepare),
    preparando: Number(data.preparing),
    enviados: Number(data.shipped),
    retirar: Number(data.to_pickup),
    listos: Number(data.done),
    todos: Number(data.all_orders),
    stockIssue: Number(data.stock_issue),
    needsReview: Number(data.needs_review),
  };
}

/** Contador del menú (0 si no es admin, como los demás contadores). */
export const getOrdersAttentionCount = cache(async (): Promise<number> => {
  const user = await getCurrentUser();
  if (!user?.isAdmin) return 0;
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .or(ATTENTION_FILTER);
  return error ? 0 : (count ?? 0);
});

// ---------------------------------------------------------------------------
// Detalle
// ---------------------------------------------------------------------------

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type OrderEvent = {
  id: string;
  kind: OrderEventKind;
  from: FulfillmentStatus | null;
  to: FulfillmentStatus | null;
  note: string | null;
  actor: string | null;
  createdAt: string;
};

export async function getOrderDetail(id: string) {
  await requireAdmin();
  if (!UUID.test(id)) return null;
  const supabase = await createClient();
  const [{ data: order, error }, { data: items }, { data: events }] = await Promise.all([
    supabase
      .from("orders")
      .select(
        "id, order_number, created_at, payment_status, fulfillment_status, delivery_method, customer_name, customer_email, customer_phone, ship_address, ship_apartment, ship_city, ship_province, ship_postal_code, ship_notes, pickup_address, pickup_hours, subtotal, shipping_cost, discount_total, coupon_code, total, mp_payment_id, mp_status, mp_status_detail, paid_at, stock_applied_at, stock_issue, needs_review, review_reason, carrier, carrier_name, tracking_code, tracking_url, shipped_at, cancelled_at, cancel_reason, stock_returned_at",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("order_items")
      .select("id, product_id, product_name, variant_label, image_path, unit_price, unit_price_before, quantity, line_total")
      .eq("order_id", id)
      .order("product_name"),
    supabase
      .from("order_events")
      .select("id, kind, from_status, to_status, note, actor_name, created_at")
      .eq("order_id", id)
      .order("created_at", { ascending: false }),
  ]);
  if (error) throw new Error("No se pudo leer el pedido.");
  if (!order) return null;

  return {
    ...order,
    // Mayúscula inicial solo para mostrar (lo guardado no cambia)
    customer_name: titleCase(order.customer_name),
    ship_city: order.ship_city && titleCase(order.ship_city),
    ship_province: order.ship_province && titleCase(order.ship_province),
    tracking: trackingFor(order),
    items: items ?? [],
    events: (events ?? []).map(
      (e): OrderEvent => ({
        id: e.id,
        kind: e.kind,
        from: e.from_status,
        to: e.to_status,
        note: e.note,
        actor: e.actor_name,
        createdAt: e.created_at,
      }),
    ),
  };
}

export type OrderDetail = NonNullable<Awaited<ReturnType<typeof getOrderDetail>>>;
