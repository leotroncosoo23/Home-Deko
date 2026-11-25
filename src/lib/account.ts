import "server-only";
import { cache } from "react";
import type { AccountDetails } from "@/lib/account-schema";
import { trackingFor, type Tracking } from "@/lib/carriers";
import { orderPath, orderToken } from "@/lib/order-token";
import { createClient } from "@/lib/supabase/server";

/**
 * Cuenta del CLIENTE en la tienda (paso 6).
 *
 * Todo se lee con el cliente de SESIÓN: el RLS deja ver solo el propio
 * perfil y los pedidos con customer_id = el usuario. Nunca se usa la clave
 * secreta para leer datos de "Mis pedidos" o "Mis datos".
 */

export type MyAccount = {
  id: string;
  email: string;
  isAdmin: boolean;
  details: AccountDetails;
};

/**
 * La cuenta logueada (o null). cache(): el encabezado, Mi cuenta y el
 * checkout preguntan una sola vez por página. Lee la sesión → en <Suspense>.
 */
export const getMyAccount = cache(async (): Promise<MyAccount | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) return null;
  const claims = data.claims;

  const { data: p } = await supabase
    .from("profiles")
    .select(
      "email, full_name, role, phone, ship_address, ship_apartment, ship_city, ship_province, ship_postal_code, ship_notes",
    )
    .eq("id", claims.sub)
    .maybeSingle();

  return {
    id: claims.sub,
    email: p?.email ?? claims.email ?? "",
    isAdmin: p?.role === "admin",
    details: {
      name: p?.full_name ?? "",
      phone: p?.phone ?? "",
      address: p?.ship_address ?? "",
      apartment: p?.ship_apartment ?? "",
      city: p?.ship_city ?? "",
      province: p?.ship_province ?? "",
      postalCode: p?.ship_postal_code ?? "",
      notes: p?.ship_notes ?? "",
    },
  };
});

export type MyOrder = {
  id: string;
  number: number;
  createdAt: string;
  total: number;
  status: CustomerOrderStatus;
  /** Link al detalle (la misma página que reciben por mail). null si no se pudo armar. */
  href: string | null;
  /** Solo si está EN CAMINO y tiene código: empresa, código y link para seguirlo. */
  tracking: Tracking | null;
  /** Solo si está LISTO PARA RETIRAR: dirección y horarios del local (los guardados en el pedido). */
  pickup: { address: string; hours: string | null } | null;
};

/**
 * "Mis pedidos": los pedidos de la cuenta, del más nuevo al más viejo.
 * No muestra los intentos de pago que vencieron sin pagarse (compras
 * abandonadas en Mercado Pago): no son compras y llenarían la lista.
 *
 * El filtro por customer_id es OBLIGATORIO aunque haya RLS: a un admin el
 * RLS le deja ver todos los pedidos, y acá van solo los suyos.
 */
export async function getMyOrders(userId: string): Promise<MyOrder[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, order_number, created_at, total, payment_status, fulfillment_status, delivery_method, mp_status, mp_expires_at, provider_status, payment_expires_at, needs_review, stock_issue, carrier, carrier_name, tracking_code, tracking_url, pickup_address, pickup_hours",
    )
    .eq("customer_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error("No se pudieron leer tus pedidos.");

  const now = Date.now();
  return (data ?? [])
    .filter((o) => {
      if (o.payment_status === "approved" || o.needs_review) return true;
      const providerStatus = o.provider_status ?? o.mp_status;
      if (o.payment_status === "pending" && (providerStatus === "pending" || providerStatus === "in_process")) return true;
      // Sin pagar (o rechazado, con Getnet se puede reintentar): solo mientras el link de pago siga vigente.
      const expiresAt = o.payment_expires_at ?? o.mp_expires_at;
      return (
        (o.payment_status === "pending" || o.payment_status === "rejected") &&
        !!expiresAt &&
        new Date(expiresAt).getTime() > now
      );
    })
    .map((o) => ({
      id: o.id,
      number: o.order_number,
      createdAt: o.created_at,
      total: Number(o.total),
      status: customerOrderStatus(o),
      href: orderHref(o.id),
      tracking: o.payment_status === "approved" && o.fulfillment_status === "shipped" ? trackingFor(o) : null,
      pickup:
        o.payment_status === "approved" && o.fulfillment_status === "ready_for_pickup" && o.pickup_address
          ? { address: o.pickup_address, hours: o.pickup_hours }
          : null,
    }));
}

/** El link secreto del pedido se deriva del id (ver order-token.ts). */
function orderHref(id: string): string | null {
  try {
    return orderPath(id, orderToken(id));
  } catch {
    // Falta ORDER_LINK_SECRET: el pedido se lista igual, sin link.
    return null;
  }
}

// ---------------------------------------------------------------------------
// Estado del pedido en palabras del cliente (versión corta, para la lista).
// Misma lógica que la página del pedido (viewFor en /pedido/[id]/page.tsx).
// ---------------------------------------------------------------------------

export type CustomerOrderStatus = { label: string; tone: "ok" | "wait" | "bad" | "done" };

type StatusInput = {
  payment_status: string;
  fulfillment_status: string;
  delivery_method: string;
  needs_review: boolean;
  stock_issue: boolean;
};

export function customerOrderStatus(o: StatusInput): CustomerOrderStatus {
  if (o.fulfillment_status === "cancelled") return { label: "Cancelado", tone: "bad" };
  if (o.payment_status === "approved") {
    if (o.stock_issue) return { label: "Te vamos a contactar", tone: "wait" };
    switch (o.fulfillment_status) {
      case "preparing":
        return { label: "Preparando", tone: "ok" };
      case "shipped":
        return { label: "En camino", tone: "ok" };
      case "delivered":
        return { label: "Entregado", tone: "done" };
      case "ready_for_pickup":
        return { label: "Listo para retirar", tone: "ok" };
      case "picked_up":
        return { label: "Retirado", tone: "done" };
    }
    return { label: "Pago confirmado", tone: "ok" };
  }
  if (o.needs_review) return { label: "Revisando el pago", tone: "wait" };
  if (o.payment_status === "rejected") return { label: "Pago rechazado", tone: "bad" };
  if (o.payment_status === "cancelled") return { label: "Pago cancelado", tone: "bad" };
  return { label: "Esperando el pago", tone: "wait" };
}

// ---------------------------------------------------------------------------
// ?volver= después de ingresar
// ---------------------------------------------------------------------------

/**
 * A dónde volver después de ingresar en /mi-cuenta. Solo rutas de la
 * tienda conocidas (nunca el panel ni otro sitio). Si no vale, null
 * (se queda en Mi cuenta).
 */
export function safeReturnPath(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return null;
  const path = value.split(/[?#]/)[0];
  const allowed = ["/finalizar-compra", "/productos", "/categorias", "/buscar"];
  if (path === "/" || allowed.some((p) => path === p || path.startsWith(`${p}/`))) return value;
  return null;
}
