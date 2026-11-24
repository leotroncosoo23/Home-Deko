import type { Carrier } from "@/lib/carriers";

/** Tipos que comparten el servidor y el navegador en Pedidos. */

export type ActionResult = { ok: true; message: string } | { ok: false; error: string };

/** Un pedido con lo necesario para imprimir rótulos y la lista de preparación. */
export type PrintOrder = {
  id: string;
  number: number;
  customerName: string;
  phone: string;
  pickup: boolean;
  address: string | null;
  apartment: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  notes: string | null;
  items: { name: string; variant: string | null; quantity: number }[];
};

export type PrintData = {
  orders: PrintOrder[];
  /** Remitente del rótulo (de Configuración; lo que falta no aparece). */
  sender: { name: string; lines: string[] };
};

export type ShipInput = {
  orderId: string;
  carrier: Carrier;
  carrierName: string;
  trackingCode: string;
  trackingUrl: string;
};
