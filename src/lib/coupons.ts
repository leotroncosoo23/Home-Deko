import { formatPrice } from "@/lib/format";

/**
 * Cupones de descuento (paso 7): lo que comparten la tienda, el panel y los
 * mails. Las REGLAS de verdad viven en la base (coupon_quote / create_order):
 * acá solo hay formato y textos.
 */

export type CouponKind = "percent" | "fixed" | "free_shipping";
export type CouponStatus = "active" | "scheduled" | "paused" | "expired" | "exhausted";

/** Mismo formato que la base: 3 a 30 letras, números o guiones, en mayúsculas. */
export const COUPON_CODE_RE = /^[A-Z0-9-]{3,30}$/;
export const COUPON_CODE_MAX = 30;

/** "  bienvenida 10 " → "BIENVENIDA10" (mayúsculas y sin espacios, como lo guarda la base). */
export function normalizeCouponCode(text: string): string {
  return text.replace(/\s+/g, "").toUpperCase();
}

/** "$ 20.000" (sin ",00" cuando es redondo). */
export function shortARS(value: number): string {
  return formatPrice(value);
}

/** "2026-12-31" → "31/12/2026" (sin pasar por Date: es un día de Argentina, no un instante). */
export function formatDay(isoDate: string | null | undefined): string {
  if (!isoDate) return "";
  const [y, m, d] = isoDate.slice(0, 10).split("-");
  return d && m && y ? `${d}/${m}/${y}` : isoDate;
}

/** Qué hace el cupón, corto: "10 %", "$ 5.000", "Envío gratis". */
export function couponValueLabel(kind: CouponKind, value: number | null): string {
  if (kind === "percent") return `${value ?? 0} %`;
  if (kind === "fixed") return shortARS(value ?? 0);
  return "Envío gratis";
}

/**
 * El cupón en una frase, para el panel:
 * "10 % de descuento en productos, para compras desde $ 30.000, hasta el 31/12/2026".
 */
export function couponSentence(c: {
  kind: CouponKind;
  value: number | null;
  minPurchase: number | null;
  startsOn: string | null;
  endsOn: string | null;
  maxUses: number | null;
  onePerCustomer: boolean;
}): string {
  const parts: string[] = [];
  if (c.kind === "percent") parts.push(`${c.value ?? "…"} % de descuento en productos`);
  else if (c.kind === "fixed") parts.push(`${c.value ? shortARS(c.value) : "$ …"} de descuento en productos`);
  else parts.push("Envío gratis (solo con envío a domicilio)");
  if (c.minPurchase) parts.push(`para compras desde ${shortARS(c.minPurchase)}`);
  if (c.startsOn && c.endsOn) parts.push(`del ${formatDay(c.startsOn)} al ${formatDay(c.endsOn)}`);
  else if (c.startsOn) parts.push(`desde el ${formatDay(c.startsOn)}`);
  else if (c.endsOn) parts.push(`hasta el ${formatDay(c.endsOn)}`);
  if (c.maxUses) parts.push(c.maxUses === 1 ? "1 uso en total" : `${c.maxUses} usos en total`);
  if (c.onePerCustomer) parts.push("un uso por cliente");
  return parts.join(", ") + ".";
}

export const COUPON_STATUS_LABEL: Record<CouponStatus, string> = {
  active: "Activo",
  scheduled: "Programado",
  paused: "Pausado",
  expired: "Vencido",
  exhausted: "Agotado",
};

// ---------------------------------------------------------------------------
// Respuesta de coupon_quote (la base) → mensaje para el cliente
// ---------------------------------------------------------------------------

export type CouponQuoteError = {
  ok: false;
  error:
    | "no_existe"
    | "pausado"
    | "no_empezo"
    | "vencido"
    | "agotado"
    | "minimo"
    | "ya_usado"
    | "solo_envio"
    | "sin_efecto"
    | "total_cero";
  starts_on?: string;
  ends_on?: string;
  min_purchase?: number | string;
  missing?: number | string;
  email?: string;
};

export type CouponQuoteOk = {
  ok: true;
  coupon_id: string;
  code: string;
  kind: CouponKind;
  discount: number | string;
  subtotal: number | string;
  shipping: number | string;
  total: number | string;
};

export type CouponQuote = CouponQuoteOk | CouponQuoteError;

/** Mensaje amable para cada motivo por el que un cupón no se puede usar. */
export function couponErrorMessage(q: CouponQuoteError): string {
  switch (q.error) {
    case "no_existe":
      return "No encontramos ese cupón. Revisá que esté bien escrito.";
    case "pausado":
      return "Este cupón no está disponible en este momento.";
    case "no_empezo":
      return q.starts_on ? `Este cupón empieza a valer el ${formatDay(q.starts_on)}.` : "Este cupón todavía no empezó.";
    case "vencido":
      return q.ends_on ? `Este cupón venció el ${formatDay(q.ends_on)}.` : "Este cupón ya venció.";
    case "agotado":
      return "Este cupón ya se usó todas las veces disponibles.";
    case "minimo": {
      const min = Number(q.min_purchase ?? 0);
      const missing = Number(q.missing ?? 0);
      return `Este cupón es para compras desde ${shortARS(min)}. Te faltan ${shortARS(missing)}.`;
    }
    case "ya_usado":
      return q.email ? `Este cupón ya se usó con el email ${q.email}.` : "Este cupón ya se usó con este email.";
    case "solo_envio":
      return "Este cupón es de envío gratis: vale si elegís envío a domicilio.";
    case "sin_efecto":
      return "Tus productos ya tienen un descuento mejor que este cupón.";
    case "total_cero":
      return "Este cupón cubre todo tu pedido. Escribinos por WhatsApp y lo coordinamos.";
    default:
      return "No pudimos aplicar este cupón.";
  }
}

export const COUPON_RATE_LIMIT_MESSAGE = "Probaste muchos códigos seguidos. Esperá un minuto y volvé a intentar.";

/** Cupón aplicado en el checkout (lo que ve el cliente en el resumen). */
export type AppliedCoupon = { code: string; kind: CouponKind; discount: number };
