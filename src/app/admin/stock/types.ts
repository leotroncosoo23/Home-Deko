import type { StockReason } from "./reasons";

/** Una variante con su stock (vista admin_variant_stock). */
export type VariantStock = {
  variantId: string;
  productId: string;
  productName: string;
  /** "Rojo / 300 ml"; null en un producto sin variantes. */
  variantLabel: string | null;
  sku: string | null;
  barcode: string;
  stock: number;
  minStock: number;
  stockStatus: "ok" | "low" | "out";
  imageUrl: string | null;
};

/** Un movimiento del historial (vista admin_stock_movements). */
export type Movement = {
  id: string;
  createdAt: string;
  productId: string;
  productName: string;
  variantLabel: string | null;
  reason: StockReason;
  quantity: number;
  stockAfter: number;
  note: string | null;
  /** Nombre o email de quien lo hizo; null = el sistema. */
  authorName: string | null;
};

export type MovementsPage = {
  items: Movement[];
  total: number;
  page: number;
  pageCount: number;
};

export type AdjustResult =
  | { ok: true; message: string; newStock: number }
  | { ok: false; error: string };

/** Nombre para mostrar: "Taza — Rojo / 300 ml" o solo "Taza". */
export function variantFullName(v: { productName: string; variantLabel: string | null }): string {
  return v.variantLabel ? `${v.productName} — ${v.variantLabel}` : v.productName;
}
