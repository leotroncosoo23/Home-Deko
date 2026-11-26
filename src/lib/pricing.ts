/**
 * PRECIOS DE LA TIENDA: contado (1 pago) y lista (cuotas).
 *
 *   - El precio cargado en cada producto (o variante) es el PRECIO DE LISTA.
 *     Nunca cambia: es el que se paga en cuotas.
 *   - Precio contado = lista − "% descuento en 1 pago" (Configuración → Precios),
 *     redondeado a pesos.
 *   - Las ofertas del producto se aplican SOLO sobre el contado: se toma la
 *     rebaja que la base ya calculó sobre la lista (finalPrice / price) y se
 *     aplica en la misma proporción sobre el contado.
 *   - Con 0 % no se redondea nada: contado = finalPrice tal cual (igual que antes).
 *
 * ESPEJO EN LA BASE: public.cash_price(price, final_price) en
 * supabase/migrations/20261207000001_precios_contado.sql hace exactamente la
 * misma cuenta y es la que usa create_order para cobrar. Si cambiás una,
 * cambiá la otra (y src/lib/pricing.test.ts + supabase/tests/precio_contado.sql).
 *
 * Las cuentas van en centavos con BigInt para que el redondeo sea idéntico al
 * de Postgres (numeric, mitad hacia arriba) y no dependa de decimales de JS.
 */

export const INSTALLMENT_OPTIONS = [3, 6, 9, 12] as const;
export type InstallmentCount = (typeof INSTALLMENT_OPTIONS)[number];

export type PricingSettings = {
  /** % de descuento por pagar en 1 pago (0 = contado igual a lista). */
  cashDiscountPercent: number;
  /** Mostrar "hasta N cuotas sin interés". */
  installmentsEnabled: boolean;
  installmentsMax: InstallmentCount;
};

export const DEFAULT_PRICING: PricingSettings = {
  cashDiscountPercent: 0,
  installmentsEnabled: false,
  installmentsMax: 6,
};

export type Prices = {
  /** Precio de lista (el cargado). */
  lista: number;
  /** Contado sin la oferta del producto (lo que se tacha si hay oferta). */
  contadoSinOferta: number;
  /** Contado final: lo que se cobra en 1 pago. */
  contado: number;
  /** Hay oferta vigente (contado < contadoSinOferta). */
  oferta: boolean;
  /** % de la oferta del producto, redondeado (null sin oferta). */
  ofertaPercent: number | null;
  /** Cantidad máxima de cuotas sin interés, o null si están apagadas. */
  cuotas: number | null;
  /** Valor de cada cuota (lista / cuotas, a centavos), o null. */
  valorCuota: number | null;
};

// Sin literales 123n: el proyecto compila a ES2017.
const ZERO = BigInt(0);
const TWO = BigInt(2);
const BASIS_100 = BigInt(10000);
const MILLION = BigInt(1000000);

const toCents = (n: number): bigint => BigInt(Math.round(n * 100));
const fromCents = (c: bigint): number => Number(c) / 100;

/** a / b redondeado mitad hacia arriba (a ≥ 0, b > 0), como round() de Postgres. */
function divRound(a: bigint, b: bigint): bigint {
  return (TWO * a + b) / (TWO * b);
}

/**
 * Contado de un precio. `price` = lista; `finalPrice` = lista con la oferta
 * (columna final_price de store_variants). Misma cuenta que public.cash_price().
 */
export function cashPrice(price: number, finalPrice: number, cashDiscountPercent: number): number {
  if (!(cashDiscountPercent > 0)) return finalPrice;
  const priceC = toCents(price);
  const finalC = toCents(finalPrice);
  // % con 2 decimales → puntos básicos (15 → 1500)
  const basis = BigInt(Math.round(cashDiscountPercent * 100));
  // round(price × (1 − d/100), 0) en pesos
  const sinOferta = divRound(priceC * (BASIS_100 - basis), MILLION);
  if (finalC < priceC && priceC > ZERO) {
    // round(sinOferta × final / price, 0)
    return Number(divRound(sinOferta * finalC, priceC));
  }
  return Number(sinOferta);
}

/** Todos los precios de un producto o variante, para mostrar. */
export function getPrices(p: { price: number; finalPrice: number }, s: PricingSettings): Prices {
  const lista = p.price;
  const contadoSinOferta = cashPrice(p.price, p.price, s.cashDiscountPercent);
  const contado = cashPrice(p.price, p.finalPrice, s.cashDiscountPercent);
  const oferta = contado < contadoSinOferta;
  const ofertaPercent =
    oferta && p.price > 0 ? Math.round((100 * (p.price - p.finalPrice)) / p.price) : null;
  const cuotas = s.installmentsEnabled && lista > 0 ? s.installmentsMax : null;
  const valorCuota = cuotas ? fromCents(divRound(toCents(lista), BigInt(cuotas))) : null;
  return { lista, contadoSinOferta, contado, oferta, ofertaPercent, cuotas, valorCuota };
}

/** Totales del carrito: en 1 pago (contado) y en cuotas (lista). */
export function cartTotals(
  lines: { price: number; finalPrice: number; qty: number }[],
  s: PricingSettings,
): { contado: number; lista: number; cuotas: number | null; valorCuota: number | null } {
  let contadoC = ZERO;
  let listaC = ZERO;
  for (const l of lines) {
    const q = BigInt(l.qty);
    contadoC += toCents(cashPrice(l.price, l.finalPrice, s.cashDiscountPercent)) * q;
    listaC += toCents(l.price) * q;
  }
  const cuotas = s.installmentsEnabled && listaC > ZERO ? s.installmentsMax : null;
  return {
    contado: fromCents(contadoC),
    lista: fromCents(listaC),
    cuotas,
    valorCuota: cuotas ? fromCents(divRound(listaC, BigInt(cuotas))) : null,
  };
}

/**
 * Filtro de precio del catálogo: el cliente escribe montos de CONTADO y la
 * base filtra por precio con oferta (final_min_price). Pasa el límite a esa
 * escala, con medio peso de margen por el redondeo del contado.
 */
export function finalBoundForCash(amount: number | null, cashDiscountPercent: number, side: "min" | "max"): number | null {
  if (amount === null || !(cashDiscountPercent > 0)) return amount;
  const factor = 1 - cashDiscountPercent / 100;
  const edge = side === "min" ? amount - 0.5 : amount + 0.5;
  return Math.max(0, Math.round((edge / factor) * 100) / 100);
}

/**
 * Lee "15,6" (PRICING_PREVIEW, solo en desarrollo) → 15 % y 6 cuotas.
 * "15" = solo el %, cuotas apagadas. Inválido → null.
 */
export function parsePricingPreview(text: string | undefined): PricingSettings | null {
  if (!text?.trim()) return null;
  const [pct, cuotas] = text.split(",").map((x) => x.trim());
  const percent = Number(pct);
  if (!Number.isFinite(percent) || percent < 0 || percent >= 100) return null;
  const n = cuotas ? Number(cuotas) : null;
  if (n !== null && !INSTALLMENT_OPTIONS.includes(n as InstallmentCount)) return null;
  return {
    cashDiscountPercent: percent,
    installmentsEnabled: n !== null,
    installmentsMax: (n ?? 6) as InstallmentCount,
  };
}
