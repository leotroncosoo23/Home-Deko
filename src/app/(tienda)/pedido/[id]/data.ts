import "server-only";
import { hashOrderToken, isOrderTokenShape } from "@/lib/order-token";
import { createAdminClient } from "@/lib/supabase/admin";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * El pedido de un invitado, SOLO si el link secreto (token) coincide.
 *
 * Se lee con la clave secreta (el invitado no tiene sesión para pasar el
 * RLS), por eso el filtro por el hash del token es obligatorio: sin él,
 * cualquiera vería cualquier pedido cambiando el id. Si no coincide,
 * devuelve null (la página muestra "no encontrado", igual que si no existiera).
 */
export async function getGuestOrder(id: string, token: unknown) {
  if (!UUID.test(id) || !isOrderTokenShape(token)) return null;

  const supabase = createAdminClient();
  const { data: order, error } = await supabase
    .from("orders")
    .select(
      "id, order_number, payment_status, fulfillment_status, delivery_method, customer_name, customer_email, ship_address, ship_city, ship_province, ship_postal_code, pickup_address, pickup_hours, subtotal, shipping_cost, discount_total, total, mp_status, mp_expires_at, stock_issue, needs_review, created_at",
    )
    .eq("id", id)
    .eq("access_token_hash", hashOrderToken(token))
    .maybeSingle();
  if (error) throw new Error("No se pudo leer el pedido.");
  if (!order) return null;

  const { data: items, error: itemsError } = await supabase
    .from("order_items")
    .select("id, product_name, variant_label, image_path, unit_price, unit_price_before, quantity, line_total")
    .eq("order_id", id)
    .order("product_name");
  if (itemsError) throw new Error("No se pudo leer el pedido.");

  return { ...order, items: items ?? [] };
}

export type GuestOrder = NonNullable<Awaited<ReturnType<typeof getGuestOrder>>>;
