import type { Database } from "@/lib/database.types";

/** Textos y colores de los estados de un pedido (panel). */

export type PaymentStatus = Database["public"]["Enums"]["payment_status"];
export type FulfillmentStatus = Database["public"]["Enums"]["fulfillment_status"];
export type DeliveryMethod = Database["public"]["Enums"]["delivery_method"];

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

export const DELIVERY_LABELS: Record<DeliveryMethod, string> = {
  shipping: "Envío a domicilio",
  pickup: "Retiro en el local",
};
