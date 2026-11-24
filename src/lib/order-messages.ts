import type { Tracking } from "@/lib/carriers";
import type { Database } from "@/lib/database.types";
import { firstNameOf } from "@/lib/format";

/**
 * Mensajes de WhatsApp para el CLIENTE, ya escritos según el estado del
 * pedido. Los usa el botón "Avisar por WhatsApp" del detalle del pedido.
 */

type FulfillmentStatus = Database["public"]["Enums"]["fulfillment_status"];

/**
 * Teléfono guardado en el pedido → número para wa.me (Argentina: 549 + característica + número).
 *   "2945123456"    → "5492945123456"
 *   "02945123456"   → "5492945123456"
 *   "5492945123456" → igual
 * Si la persona escribió el "15" del celular ("2945 15 123456"), WhatsApp suele
 * resolverlo igual; no se intenta adivinar.
 */
export function whatsappNumberAR(phone: string): string | null {
  let digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("54")) {
    digits = digits.slice(2);
    if (digits.startsWith("9")) digits = digits.slice(1);
  }
  digits = digits.replace(/^0/, "");
  if (digits.length < 8) return null;
  return `549${digits}`;
}

export type MessageOrder = {
  number: number;
  customerName: string;
  status: FulfillmentStatus;
  pickupAddress: string | null;
  pickupHours: string | null;
  tracking: Tracking | null;
  /** Link al pedido para el cliente (null si no se puede armar). */
  orderUrl: string | null;
};

/**
 * Piso/depto e indicaciones del envío en un renglón (o null si no cargó ninguno):
 *   "Piso / Depto: 2° B · Indicaciones: entre Roca y Rivadavia, timbre 3"
 */
export function deliveryDetails(apartment: string | null, notes: string | null): string | null {
  const parts = [apartment && `Piso / Depto: ${apartment}`, notes && `Indicaciones: ${notes}`].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

export function customerMessage(o: MessageOrder): string {
  const hi = `¡Hola ${firstNameOf(o.customerName)}! Te escribimos de Home Deko por tu pedido #${o.number}.`;
  const link = o.orderUrl ? `\n\nPodés ver el estado de tu pedido acá: ${o.orderUrl}` : "";

  switch (o.status) {
    case "paid":
      return `${hi}\n\nRecibimos tu pago. Ya lo estamos por preparar y te avisamos apenas salga.${link}`;
    case "preparing":
      return `${hi}\n\nEstamos preparando tu pedido. Te avisamos apenas esté listo.${link}`;
    case "shipped": {
      const t = o.tracking;
      const track = t
        ? `\n\nLo enviamos por ${t.carrierLabel}. Código de seguimiento: ${t.code}${
            t.url ? `\nSeguilo acá: ${t.url}${t.urlHasCode ? "" : " (pegá el código en la página)"}` : ""
          }`
        : "";
      return `${hi}\n\n¡Tu pedido ya está en camino!${track}${link}`;
    }
    case "delivered":
      return `${hi}\n\nNos figura que tu pedido ya fue entregado. ¡Esperamos que lo disfrutes! Cualquier cosa, escribinos por acá.`;
    case "ready_for_pickup": {
      const where = o.pickupAddress ? `\n\nTe esperamos en ${o.pickupAddress}.` : "";
      const hours = o.pickupHours ? `\nHorarios: ${o.pickupHours}.` : "";
      return `${hi}\n\n¡Tu pedido está listo para retirar!${where}${hours}\n\nAl retirarlo, decinos tu nombre o el número de pedido.`;
    }
    case "picked_up":
      return `${hi}\n\n¡Gracias por retirar tu pedido! Esperamos que lo disfrutes.`;
    case "cancelled":
      return `${hi}\n\nTe contamos que tu pedido quedó cancelado. Si ya lo habías pagado, la devolución del dinero la ves en tu cuenta de Mercado Pago o en el resumen de tu tarjeta.`;
    default:
      return hi;
  }
}

export function whatsappToCustomer(phone: string, message: string): string | null {
  const number = whatsappNumberAR(phone);
  return number ? `https://wa.me/${number}?text=${encodeURIComponent(message)}` : null;
}
