import "server-only";
import { cache } from "react";
import { getCurrentUser, requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { DeliveryMethod, FulfillmentStatus, PaymentStatus } from "./status";

/**
 * Lecturas de Pedidos (con la sesión del admin: el RLS deja ver todos los
 * pedidos solo a los admins). El detalle y los cambios de estado son del paso 5.
 */

export type OrderFilter = "pagados" | "todos";

export const ORDERS_LIMIT = 100;

/**
 * "Requiere atención" = cobrados que todavía no se empezaron a preparar
 * (incluye los "pagados sin stock") + los marcados "para revisar".
 * El mismo criterio usan el contador del menú y la lista "Pagados".
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
  paymentStatus: PaymentStatus;
  fulfillmentStatus: FulfillmentStatus;
  stockIssue: boolean;
  needsReview: boolean;
  reviewReason: string | null;
};

export async function getOrders(filter: OrderFilter): Promise<{ items: OrderRow[]; total: number }> {
  await requireAdmin();
  const supabase = await createClient();
  let query = supabase
    .from("orders")
    .select(
      "id, order_number, created_at, customer_name, customer_email, customer_phone, delivery_method, ship_city, ship_province, total, payment_status, fulfillment_status, stock_issue, needs_review, review_reason",
      { count: "exact" },
    );
  // "Pagados": los cobrados + los que hay que revisar (sin los intentos que
  // quedaron sin pagar, que son la mayoría y no requieren nada).
  if (filter === "pagados") query = query.or("payment_status.eq.approved,needs_review.eq.true");

  const { data, count, error } = await query.order("created_at", { ascending: false }).limit(ORDERS_LIMIT);
  if (error) throw new Error("No se pudieron leer los pedidos.");

  return {
    total: count ?? data.length,
    items: data.map((o) => ({
      id: o.id,
      number: o.order_number,
      createdAt: o.created_at,
      customerName: o.customer_name,
      customerEmail: o.customer_email,
      customerPhone: o.customer_phone,
      delivery: o.delivery_method,
      place: o.ship_city ? `${o.ship_city}, ${o.ship_province}` : null,
      total: Number(o.total),
      paymentStatus: o.payment_status,
      fulfillmentStatus: o.fulfillment_status,
      stockIssue: o.stock_issue,
      needsReview: o.needs_review,
      reviewReason: o.review_reason,
    })),
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
