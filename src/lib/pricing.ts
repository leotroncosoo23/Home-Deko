/**
 * PRECIOS DE LA TIENDA: en 1 pago (contado) y de lista (cuotas).
 *
 *   - El precio cargado en cada producto (o variante) es el PRECIO EN 1 PAGO
 *     (contado). Es el que se cobra hoy.
 *   - Las ofertas del producto se aplican sobre ese precio, como siempre
 *     (final_price, lo calcula la base en store_variants / store_products).
 *   - Precio de lista (cuotas) = precio cargado SIN oferta × (1 + recargo/100)
 *     ("% recargo para precio de lista", Configuración → Precios), a centavos.
 *     No cambia con la oferta. Con 0 % la lista es igual al contado.
 *   - Valor de cada cuota = lista / cuotas.
 *
 * COBRO: create_order cobra final_price en la base (el precio cargado con la
 * oferta), nunca lo que manda el navegador. contado de getPrices() es ese
 * mismo número. Ver src/lib/pricing.test.ts y supabase/tests/precio_contado.sql.
 *
 * Las cuentas van en centavos con BigInt para que el redondeo sea exacto
 * (mitad hacia arriba) y no dependa de decimales de JS.
 */

export const INSTALLMENT_OPTIONS = [3, 6, 9, 12] as const;
export type InstallmentCount = (typeof INSTALLMENT_OPTIONS)[number];

/** El recargo tiene que ser menor que esto (check de la base). */
export const LIST_SURCHARGE_LIMIT = 1000;

export type PricingSettings = {
  /** % de recargo para el precio de lista (cuotas). 0 = lista igual a contado. */
  listSurchargePercent: number;
  /** Mostrar "hasta N cuotas sin interés". */
  installmentsEnabled: boolean;
  installmentsMax: InstallmentCount;
};

export const DEFAULT_PRICING: PricingSettings = {
  listSurchargePercent: 0,
  installmentsEnabled: false,
  installmentsMax: 6,
};

export type Prices = {
  /** Precio de lista (cuotas): contado sin oferta + recargo. */
  lista: number;
  /** Precio cargado, sin la oferta (lo que se tacha si hay oferta). */
  contadoSinOferta: number;
  /** Contado final: lo que se cobra en 1 pago (precio cargado con la oferta). */
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

const toCents = (n: number): bigint => BigInt(Math.round(n * 100));
const fromCents = (c: bigint): number => Number(c) / 100;

/** a / b redondeado mitad hacia arriba (a ≥ 0, b > 0). */
function divRound(a: bigint, b: bigint): bigint {
  return (TWO * a + b) / (TWO * b);
}

/** Lista en centavos: contado × (1 + recargo/100), redondeado a centavos. */
function listCents(price: number, listSurchargePercent: number): bigint {
  const priceC = toCents(price);
  if (!(listSurchargePercent > 0)) return priceC;
  // % con 2 decimales → puntos básicos (24 → 2400)
  const basis = BigInt(Math.round(listSurchargePercent * 100));
  return divRound(priceC * (BASIS_100 + basis), BASIS_100);
}

/** Precio de lista de un precio cargado (sin oferta). Ej.: 38.000 con 24 % → 47.120. */
export function listPrice(price: number, listSurchargePercent: number): number {
  if (!(listSurchargePercent > 0)) return price;
  return fromCents(listCents(price, listSurchargePercent));
}

/** Todos los precios de un producto o variante, para mostrar. */
export function getPrices(p: { price: number; finalPrice: number }, s: PricingSettings): Prices {
  const contadoSinOferta = p.price;
  const contado = p.finalPrice;
  const lista = listPrice(p.price, s.listSurchargePercent);
  const oferta = contado < contadoSinOferta;
  const ofertaPercent =
    oferta && p.price > 0 ? Math.round((100 * (p.price - p.finalPrice)) / p.price) : null;
  const cuotas = s.installmentsEnabled && lista > 0 ? s.installmentsMax : null;
  const valorCuota = cuotas ? fromCents(divRound(toCents(lista), BigInt(cuotas))) : null;
  return { lista, contadoSinOferta, contado, oferta, ofertaPercent, cuotas, valorCuota };
}

/**
 * Totales del carrito: en 1 pago (contado) y en cuotas (lista).
 * `shipping` (checkout) se suma igual a los dos: el envío no lleva recargo.
 */
export function cartTotals(
  lines: { price: number; finalPrice: number; qty: number }[],
  s: PricingSettings,
  shipping = 0,
): { contado: number; lista: number; cuotas: number | null; valorCuota: number | null } {
  let contadoC = toCents(shipping);
  let listaC = toCents(shipping);
  for (const l of lines) {
    const q = BigInt(l.qty);
    contadoC += toCents(l.finalPrice) * q;
    listaC += listCents(l.price, s.listSurchargePercent) * q;
  }
  const cuotas = s.installmentsEnabled && listaC > ZERO ? s.installmentsMax : null;
  return {
    contado: fromCents(contadoC),
    lista: fromCents(listaC),
    cuotas,
    valorCuota: cuotas ? fromCents(divRound(listaC, BigInt(cuotas))) : null,
  };
}

// ---------------------------------------------------------------------------
// Forma de pago del checkout: 1 pago (contado) o N cuotas (lista)
// ---------------------------------------------------------------------------

export type PaymentPlan = "single" | "installments";

/** Cantidades de cuotas que se pueden elegir (3/6/9/12 hasta el máximo); [] si están apagadas. */
export function installmentChoices(s: PricingSettings): InstallmentCount[] {
  if (!s.installmentsEnabled) return [];
  return INSTALLMENT_OPTIONS.filter((n) => n <= s.installmentsMax);
}

/** ¿Se puede pagar así? Misma regla que create_order (la que vale es la de la base). */
export function isAllowedPlan(plan: PaymentPlan, installments: number | null, s: PricingSettings): boolean {
  if (plan === "single") return installments === null;
  return installments !== null && installmentChoices(s).includes(installments as InstallmentCount);
}

/** "1 pago" o "6 cuotas" (panel de pedidos y mails). Un plan desconocido se toma como 1 pago. */
export function paymentPlanLabel(plan: string | null | undefined, installments: number | null | undefined): string {
  return plan === "installments" && installments ? `${installments} cuotas` : "1 pago";
}

/** Valor de cada cuota: total / N, a centavos (mitad hacia arriba). */
export function installmentValue(total: number, installments: number): number {
  return fromCents(divRound(toCents(total), BigInt(installments)));
}

/**
 * Total que se cobra según la forma de pago, con el mismo carrito que
 * cartTotals(): 1 pago → contado; cuotas → lista. El envío ya viene sumado.
 * Igual que create_order (supabase/migrations/20261209000001_checkout_cuotas.sql).
 */
export function planTotal(
  totals: { contado: number; lista: number },
  plan: PaymentPlan,
): number {
  return plan === "installments" ? totals.lista : totals.contado;
}

/**
 * Lee "24,6" (PRICING_PREVIEW, solo en desarrollo) → 24 % de recargo y 6
 * cuotas. "24" = solo el recargo, cuotas apagadas. Inválido → null.
 */
export function parsePricingPreview(text: string | undefined): PricingSettings | null {
  if (!text?.trim()) return null;
  const [pct, cuotas] = text.split(",").map((x) => x.trim());
  const percent = Number(pct);
  if (!Number.isFinite(percent) || percent < 0 || percent >= LIST_SURCHARGE_LIMIT) return null;
  const n = cuotas ? Number(cuotas) : null;
  if (n !== null && !INSTALLMENT_OPTIONS.includes(n as InstallmentCount)) return null;
  return {
    listSurchargePercent: percent,
    installmentsEnabled: n !== null,
    installmentsMax: (n ?? 6) as InstallmentCount,
  };
}
