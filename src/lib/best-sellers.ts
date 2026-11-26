/**
 * "MÁS VENDIDOS" DEL INICIO: la cuenta, separada de la consulta para poder
 * probarla (src/lib/best-sellers.test.ts). Sin "server-only": es puro.
 */

/** Mínimo de productos con ventas para titular la tira "Más vendidos". */
export const BEST_SELLERS_MIN = 4;

/** Una línea de pedido pagado: qué producto y cuántas unidades. */
export type SoldLine = { product_id: string | null; quantity: number | null };

/**
 * Suma las unidades por producto y devuelve los ids del más vendido al
 * menos vendido. Las líneas de un producto borrado (product_id null) o con
 * cantidad inválida no cuentan. Empate: primero el que apareció antes
 * (orden estable), así el resultado no "baila" entre una carga y otra.
 */
export function rankBestSellers(lines: SoldLine[]): string[] {
  const units = new Map<string, number>();
  for (const line of lines) {
    const qty = Number(line.quantity);
    if (!line.product_id || !Number.isFinite(qty) || qty <= 0) continue;
    units.set(line.product_id, (units.get(line.product_id) ?? 0) + qty);
  }
  return [...units.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
}

/**
 * Qué muestra la tira: con 4 o más productos vendidos (que todavía se
 * pueden comprar) → "Más vendidos"; si no, los destacados, con ese título.
 * Así el título siempre es verdad.
 */
export function pickBestSellersOrFeatured<T>(
  bestSellers: T[],
  featured: T[],
  limit: number,
): { kind: "best" | "featured"; products: T[] } {
  if (bestSellers.length >= BEST_SELLERS_MIN) return { kind: "best", products: bestSellers.slice(0, limit) };
  return { kind: "featured", products: featured.slice(0, limit) };
}
