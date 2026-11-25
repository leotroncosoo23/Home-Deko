import { z } from "zod";
import { CART_MAX_ITEMS, CART_MAX_QTY } from "@/lib/cart";
import { COUPON_CODE_RE, normalizeCouponCode } from "@/lib/coupons";

/**
 * Datos del formulario de /finalizar-compra. Se validan en el navegador
 * (para avisar rápido) y OTRA VEZ en el servidor (que es el que vale).
 *
 * Los precios NO están acá: el navegador solo dice qué variantes y cuántas.
 */

export const PROVINCIAS = [
  "Buenos Aires",
  "Ciudad Autónoma de Buenos Aires",
  "Catamarca",
  "Chaco",
  "Chubut",
  "Córdoba",
  "Corrientes",
  "Entre Ríos",
  "Formosa",
  "Jujuy",
  "La Pampa",
  "La Rioja",
  "Mendoza",
  "Misiones",
  "Neuquén",
  "Río Negro",
  "Salta",
  "San Juan",
  "San Luis",
  "Santa Cruz",
  "Santa Fe",
  "Santiago del Estero",
  "Tierra del Fuego",
  "Tucumán",
] as const;

export type DeliveryMethod = "shipping" | "pickup";

/** Largos máximos de piso/depto e indicaciones (iguales a los de la base). */
export const APARTMENT_MAX = 40;
export const NOTES_MAX = 150;

// Reglas compartidas con "Mis datos" (src/lib/account-schema.ts): las mismas
// que la base para los pedidos y el perfil.
export const optionalText = (max: number) => z.string().trim().max(max, "Es un poco largo: acortalo, por favor.").optional();

export const nameSchema = z
  .string()
  .trim()
  .min(2, "Escribí tu nombre y apellido.")
  .max(120, "El nombre es demasiado largo.");

/** Se guardan solo los números (sin espacios, guiones ni "+"). */
export const phoneSchema = z
  .string()
  .transform((v) => v.replace(/\D/g, ""))
  .pipe(
    z
      .string()
      .min(8, "Escribí tu teléfono con la característica (por ejemplo, 2945 123456).")
      .max(15, "Revisá el teléfono: tiene demasiados números."),
  );

export const POSTAL_CODE_RE = /^[A-Za-z]?\d{4}[A-Za-z]{0,3}$/;
export const POSTAL_CODE_ERROR = "Revisá el código postal (por ejemplo, 9203 o U9203ABC).";

/** Lo único que el navegador dice del carrito: qué variantes y cuántas. */
export const itemsSchema = z
  .array(z.object({ variantId: z.uuid(), qty: z.number().int().min(1).max(CART_MAX_QTY) }))
  .min(1, "Tu carrito está vacío.")
  .max(CART_MAX_ITEMS);

/** Código de cupón: mayúsculas y sin espacios ("" = sin cupón). */
export const couponCodeSchema = z
  .string()
  .max(60)
  .transform(normalizeCouponCode)
  .pipe(z.union([z.literal(""), z.string().regex(COUPON_CODE_RE, "Revisá el código del cupón.")]));

/** DNI: 7 u 8 números (se aceptan puntos y espacios al escribirlo; se guardan solo los números). */
export const DNI_RE = /^\d{7,8}$/;
export const DNI_ERROR = "Escribí tu DNI: 7 u 8 números, sin puntos.";

export const dniSchema = z
  .string()
  .transform((v) => v.replace(/[\s.-]/g, ""))
  .pipe(z.string().regex(DNI_RE, DNI_ERROR));

/**
 * "Mitre 123" → { street: "Mitre", number: "123" }. El número es lo último
 * (con letra opcional: "123B") o "S/N". null si no se puede separar.
 * Getnet pide calle y número por separado para la facturación.
 */
export function splitStreetNumber(address: string): { street: string; number: string } | null {
  const text = address.trim().replace(/\s+/g, " ");
  const sn = /^(.*\S)\s+(s\/?n)$/i.exec(text);
  if (sn) return { street: sn[1].replace(/[,\s]+$/, ""), number: "S/N" };
  const m = /^(.*\D)\s*(?:n[°º]?\s*)?(\d{1,6}\s?[A-Za-z]?)$/i.exec(text);
  if (!m) return null;
  const street = m[1].replace(/[,\s]+$/, "").replace(/\s+n[°º]?$/i, "").trim();
  return street.length >= 2 ? { street, number: m[2].replace(/\s/g, "").toUpperCase() } : null;
}

const checkoutObject = z.object({
  name: nameSchema,
  email: z.string().trim().pipe(z.email("Revisá el email: parece que falta algo.")),
  phone: phoneSchema,
  delivery: z.enum(["shipping", "pickup"], "Elegí cómo querés recibir tu compra."),
  address: optionalText(200),
  /** Piso / depto (opcional). Mismo largo máximo que la base. */
  apartment: optionalText(APARTMENT_MAX),
  /** Indicaciones para la entrega (opcional): entre calles, timbre… */
  notes: optionalText(NOTES_MAX),
  city: optionalText(100),
  province: z.string().optional(),
  postalCode: optionalText(8),
  /** DNI y facturación: los exige Getnet (con Mercado Pago no se piden). */
  dni: z.string().max(20).optional(),
  billingStreet: optionalText(200),
  billingNumber: optionalText(20),
  billingPostalCode: optionalText(8),
  acceptTerms: z.literal(true, "Para seguir, aceptá los Términos y condiciones."),
  /** Con sesión: guardar nombre, teléfono y dirección en "Mis datos". Sin sesión se ignora. */
  saveToAccount: z.boolean().optional(),
  /** Cupón aplicado (opcional). Solo el código: el descuento lo calcula la base. */
  couponCode: couponCodeSchema.optional(),
  items: itemsSchema,
});

type CheckoutObject = z.output<typeof checkoutObject>;

function refineCheckout(data: CheckoutObject, ctx: z.RefinementCtx, requireBilling: boolean) {
  if (data.delivery === "shipping") {
    if (!data.address || data.address.length < 4) {
      ctx.addIssue({ code: "custom", path: ["address"], message: "Escribí la calle y el número." });
    } else if (requireBilling && !splitStreetNumber(data.address)) {
      ctx.addIssue({
        code: "custom",
        path: ["address"],
        message: "Escribí la calle y el número (por ejemplo, Mitre 123). Si no tiene número, poné S/N.",
      });
    }
    if (!data.city || data.city.length < 2) {
      ctx.addIssue({ code: "custom", path: ["city"], message: "Escribí tu ciudad o localidad." });
    }
    if (!data.province || !(PROVINCIAS as readonly string[]).includes(data.province)) {
      ctx.addIssue({ code: "custom", path: ["province"], message: "Elegí tu provincia." });
    }
    if (!data.postalCode || !POSTAL_CODE_RE.test(data.postalCode)) {
      ctx.addIssue({ code: "custom", path: ["postalCode"], message: POSTAL_CODE_ERROR });
    }
  }

  if (!requireBilling) return;
  if (!dniSchema.safeParse(data.dni ?? "").success) {
    ctx.addIssue({ code: "custom", path: ["dni"], message: DNI_ERROR });
  }
  // Con envío, la facturación es la dirección de envío. Con retiro, se pide aparte.
  if (data.delivery === "pickup") {
    if (!data.billingStreet || data.billingStreet.length < 2) {
      ctx.addIssue({ code: "custom", path: ["billingStreet"], message: "Escribí la calle." });
    }
    if (!data.billingNumber || !/^(\d{1,6}[A-Za-z]?|s\/?n)$/i.test(data.billingNumber.replace(/\s/g, ""))) {
      ctx.addIssue({ code: "custom", path: ["billingNumber"], message: "Escribí el número (o S/N)." });
    }
    if (!data.billingPostalCode || !POSTAL_CODE_RE.test(data.billingPostalCode)) {
      ctx.addIssue({ code: "custom", path: ["billingPostalCode"], message: POSTAL_CODE_ERROR });
    }
  }
}

/** Validación del checkout. Con Getnet (`requireBilling`), DNI y dirección de facturación son obligatorios. */
export function checkoutSchemaFor(requireBilling: boolean) {
  return checkoutObject.superRefine((data, ctx) => refineCheckout(data, ctx, requireBilling));
}

/** Datos de facturación listos para el pedido (null si faltan). */
export function billingFrom(data: CheckoutObject): {
  dni: string;
  street: string;
  number: string;
  postalCode: string;
} | null {
  const dni = dniSchema.safeParse(data.dni ?? "");
  if (!dni.success) return null;
  if (data.delivery === "shipping") {
    const split = splitStreetNumber(data.address ?? "");
    if (!split || !data.postalCode) return null;
    return { dni: dni.data, ...split, postalCode: data.postalCode.toUpperCase() };
  }
  if (!data.billingStreet || !data.billingNumber || !data.billingPostalCode) return null;
  const number = data.billingNumber.replace(/\s/g, "").toUpperCase();
  return {
    dni: dni.data,
    street: data.billingStreet.trim(),
    number: /^S\/?N$/.test(number) ? "S/N" : number,
    postalCode: data.billingPostalCode.toUpperCase(),
  };
}

/** Sin DNI ni facturación (Mercado Pago). */
export const checkoutSchema = checkoutSchemaFor(false);

export type CheckoutInput = z.input<typeof checkoutSchema>;
export type CheckoutFieldName = Exclude<keyof CheckoutInput, "items" | "saveToAccount">;
export type CheckoutFieldErrors = Partial<Record<CheckoutFieldName, string>>;

/** Primer error de cada campo, listo para mostrar debajo de cada uno. */
export function fieldErrorsFrom(error: z.ZodError): CheckoutFieldErrors {
  const out: CheckoutFieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path[0] as CheckoutFieldName | "items" | "saveToAccount" | undefined;
    if (key && key !== "items" && key !== "saveToAccount" && !out[key]) out[key] = issue.message;
  }
  return out;
}

/** Resultado de la Server Action del checkout. */
export type CheckoutResult =
  | { ok: true; redirectUrl: string; orderUrl: string }
  | {
      ok: false;
      error: string;
      fieldErrors?: CheckoutFieldErrors;
      /** El carrito cambió (stock o productos): hay que volver a cargarlo. */
      cartChanged?: boolean;
      /** El cupón ya no vale (venció, se agotó…): se quita y se muestra este mensaje junto al campo. */
      couponError?: string;
      /** El medio de pago no está configurado: se ofrece WhatsApp. */
      paymentsUnavailable?: boolean;
    };

/** Lo que ve el cliente si el medio de pago no tiene credenciales. */
export const PAYMENTS_UNAVAILABLE_MESSAGE =
  "Los pagos online no están disponibles en este momento, escribinos por WhatsApp.";

/** Resultado de "Aplicar" cupón en el checkout. */
export type CouponCheckResult =
  | { ok: true; code: string; kind: "percent" | "fixed" | "free_shipping"; discount: number }
  | { ok: false; error: string };
