/**
 * CARRITO: tipos que comparten el navegador y el servidor.
 *
 * Regla de oro: el navegador guarda SOLO { variantId, qty }. Nombres,
 * fotos, precios y stock los lee siempre el servidor (getCartLines en
 * src/app/(tienda)/actions.ts) en el momento de mostrar el carrito.
 * Aunque alguien edite su localStorage, lo único que puede cambiar es QUÉ
 * pide y CUÁNTO; nunca a qué precio.
 */

import type { PricingSettings } from "@/lib/pricing";

/** Lo que se guarda en el navegador. */
export type CartItem = { variantId: string; qty: number };

/** Límites (también los valida el servidor). */
export const CART_MAX_ITEMS = 50;
export const CART_MAX_QTY = 99;

export type CartLineStatus =
  /** Todo bien. */
  | "ok"
  /** Había más unidades en el carrito que en stock: se bajó la cantidad. */
  | "adjusted"
  /** Sin stock, despublicado, archivado o en una categoría oculta. */
  | "unavailable";

/** Una línea del carrito, tal como la arma el servidor. */
export type CartLine = {
  variantId: string;
  status: CartLineStatus;
  /** Cantidad válida (ya ajustada al stock). 0 si no está disponible. */
  qty: number;
  /** null si el producto ya no se ve en la tienda (no se puede saber cuál era). */
  name: string | null;
  slug: string | null;
  /** "Rojo / 30 cm" (null si el producto no tiene opciones). */
  variantLabel: string | null;
  imageUrl: string | null;
  /** Precio unitario a pagar hoy: CONTADO, en 1 pago (src/lib/pricing.ts). */
  unitPrice: number;
  /** Contado sin la oferta del producto, si hay oferta vigente. */
  unitPriceBefore: number | null;
  /** Precio de lista (el cargado; el de cuotas). */
  listPrice: number;
  /** Lista con la oferta (final_price de la base). Para cartTotals(). */
  offerPrice: number;
  /** Tope de unidades (el stock). No se muestra. */
  maxQty: number;
};

export type CartData = {
  lines: CartLine[];
  /** Costo del envío a domicilio (de Configuración). El retiro es gratis. */
  shippingCost: number;
  /** % de 1 pago y cuotas, para los totales. */
  pricing: PricingSettings;
};

/** "2 productos" / "1 producto". */
export function productCountLabel(n: number): string {
  return n === 1 ? "1 producto" : `${n} productos`;
}
