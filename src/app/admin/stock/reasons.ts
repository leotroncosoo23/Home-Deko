import type { Database } from "@/lib/database.types";

/**
 * Motivos de los movimientos de stock (enum stock_reason de la base) con
 * el texto que se muestra y si suman o restan.
 */
export type StockReason = Database["public"]["Enums"]["stock_reason"];

export const REASON_LABELS: Record<StockReason, string> = {
  inicial: "Stock inicial",
  ingreso: "Ingreso de mercadería",
  venta_local: "Venta en el local",
  venta_web: "Venta web",
  ajuste: "Corrección",
  rotura: "Rotura",
  devolucion: "Devolución",
};

/**
 * Motivos que se eligen en "Ajustar stock".
 *   sign  +1 → la cantidad suma · −1 → resta · 0 → corrección (se escribe
 *   el stock contado y la base calcula la diferencia)
 * ("inicial" lo pone el alta del producto y "venta_web" el checkout: no se
 * eligen a mano.)
 */
export const ADJUST_REASONS = [
  { reason: "ingreso", label: "Ingreso de mercadería", short: "Ingreso", sign: 1 },
  { reason: "venta_local", label: "Venta en el local", short: "Venta", sign: -1 },
  { reason: "rotura", label: "Rotura", short: "Rotura", sign: -1 },
  { reason: "devolucion", label: "Devolución", short: "Devolución", sign: 1 },
  { reason: "ajuste", label: "Corrección (conteo)", short: "Corrección", sign: 0 },
] as const satisfies readonly { reason: StockReason; label: string; short: string; sign: -1 | 0 | 1 }[];

export type AdjustReason = (typeof ADJUST_REASONS)[number]["reason"];

/** Colores del badge de cada motivo (sobrios; el rojo queda para "sin stock"). */
export const REASON_STYLES: Record<StockReason, string> = {
  inicial: "bg-muted text-muted-foreground",
  ingreso: "bg-emerald-50 text-emerald-700",
  devolucion: "bg-emerald-50 text-emerald-700",
  venta_local: "bg-secondary text-foreground",
  venta_web: "bg-secondary text-foreground",
  rotura: "bg-amber-50 text-amber-800",
  ajuste: "bg-sky-50 text-sky-800",
};
