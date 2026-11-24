import type { Database } from "@/lib/database.types";

/** Textos y colores de los estados de un pedido (panel). */

export type PaymentStatus = Database["public"]["Enums"]["payment_status"];
export type FulfillmentStatus = Database["public"]["Enums"]["fulfillment_status"];
export type DeliveryMethod = Database["public"]["Enums"]["delivery_method"];
export type OrderEventKind = Database["public"]["Enums"]["order_event_kind"];

export const PAYMENT_LABELS: Record<PaymentStatus, string> = {
  pending: "Pendiente",
  approved: "Aprobado",
  rejected: "Rechazado",
  cancelled: "Cancelado",
};

// Verde = OK · gris = esperando · rojo = no se cobró
export const PAYMENT_STYLES: Record<PaymentStatus, string> = {
  pending: "bg-secondary text-muted-foreground",
  approved: "bg-emerald-50 text-emerald-700",
  rejected: "bg-brand-soft text-brand",
  cancelled: "bg-brand-soft text-brand",
};

export const FULFILLMENT_LABELS: Record<FulfillmentStatus, string> = {
  awaiting_payment: "Esperando el pago",
  paid: "Para preparar",
  preparing: "Preparando",
  shipped: "Enviado",
  delivered: "Entregado",
  ready_for_pickup: "Listo para retirar",
  picked_up: "Retirado",
  cancelled: "Cancelado",
};

// Ámbar = hay que hacer algo · azul = en curso · verde = terminado · gris = no aplica
export const FULFILLMENT_STYLES: Record<FulfillmentStatus, string> = {
  awaiting_payment: "bg-secondary text-muted-foreground",
  paid: "bg-amber-50 text-amber-800",
  preparing: "bg-sky-50 text-sky-800",
  shipped: "bg-sky-50 text-sky-800",
  ready_for_pickup: "bg-sky-50 text-sky-800",
  delivered: "bg-emerald-50 text-emerald-700",
  picked_up: "bg-emerald-50 text-emerald-700",
  cancelled: "bg-secondary text-muted-foreground",
};

export const DELIVERY_LABELS: Record<DeliveryMethod, string> = {
  shipping: "Envío a domicilio",
  pickup: "Retiro en el local",
};

/** Títulos de la línea de tiempo (los cambios de estado usan el estado nuevo). */
export const EVENT_LABELS: Record<OrderEventKind, string> = {
  created: "El cliente hizo el pedido",
  payment_approved: "Pago aprobado",
  needs_review: "Quedó para revisar",
  status: "Cambio de estado",
  tracking_updated: "Seguimiento corregido",
  cancelled: "Pedido cancelado",
  stock_returned: "Volvió el stock",
  issue_resolved: "Aviso resuelto",
  email_sent: "Mail enviado",
  email_failed: "Mail no enviado",
};

const dateFormat = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Argentina/Buenos_Aires",
});
/** "24/11/26 15:30" (hora de Argentina). */
export const formatOrderDate = (iso: string) => dateFormat.format(new Date(iso)).replace(",", "");

/** Pasos que ve el cliente y la línea del detalle, según la entrega. */
export const STEPS: Record<DeliveryMethod, FulfillmentStatus[]> = {
  shipping: ["paid", "preparing", "shipped", "delivered"],
  pickup: ["paid", "preparing", "ready_for_pickup", "picked_up"],
};
