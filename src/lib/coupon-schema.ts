import { z } from "zod";
import { COUPON_CODE_RE, normalizeCouponCode } from "@/lib/coupons";
import { parseInteger, parseMoney } from "@/lib/format";

/**
 * Formulario de cupones del panel. Se valida en el navegador (para avisar
 * rápido) y OTRA VEZ en el servidor. Las mismas reglas están en la base
 * (save_coupon), que es la última palabra.
 *
 * Los montos y números llegan como texto, tal como los escribe una persona
 * ("5.000", "12.500,50").
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_MONEY = 99_999_999;

export const couponFormSchema = z
  .object({
    id: z.uuid().optional(),
    code: z
      .string()
      .transform(normalizeCouponCode)
      .pipe(
        z
          .string()
          .min(3, "El código tiene que tener al menos 3 caracteres.")
          .max(30, "El código puede tener hasta 30 caracteres.")
          .regex(COUPON_CODE_RE, "Usá solo letras sin tilde, números o guiones (sin espacios ni Ñ)."),
      ),
    kind: z.enum(["percent", "fixed", "free_shipping"], "Elegí el tipo de cupón."),
    value: z.string().optional(),
    startsOn: z.string().optional(),
    endsOn: z.string().optional(),
    maxUses: z.string().optional(),
    minPurchase: z.string().optional(),
    onePerCustomer: z.boolean(),
    isActive: z.boolean(),
  })
  .transform((d, ctx) => {
    const issue = (path: string, message: string) => {
      ctx.addIssue({ code: "custom", path: [path], message });
    };

    // Valor según el tipo
    let value: number | null = null;
    if (d.kind === "percent") {
      const n = parseInteger(d.value ?? "");
      if (n === null || Number.isNaN(n) || n < 1 || n > 100) issue("value", "Escribí un porcentaje entero entre 1 y 100.");
      else value = n;
    } else if (d.kind === "fixed") {
      const n = parseMoney(d.value ?? "");
      if (n === null || Number.isNaN(n) || n <= 0 || n > MAX_MONEY) issue("value", "Escribí el monto del descuento.");
      else value = n;
    }

    const startsOn = d.startsOn?.trim() || null;
    const endsOn = d.endsOn?.trim() || null;
    if (startsOn && !DATE_RE.test(startsOn)) issue("startsOn", "Revisá la fecha.");
    if (endsOn && !DATE_RE.test(endsOn)) issue("endsOn", "Revisá la fecha.");
    // Formato AAAA-MM-DD: se pueden comparar como texto
    if (startsOn && endsOn && endsOn < startsOn) issue("endsOn", "La fecha “hasta” no puede ser anterior a “desde”.");

    let maxUses: number | null = null;
    if (d.maxUses?.trim()) {
      const n = parseInteger(d.maxUses);
      if (n === null || Number.isNaN(n) || n < 1 || n > 1_000_000) issue("maxUses", "Escribí un número entero, 1 o más (o dejalo vacío).");
      else maxUses = n;
    }

    let minPurchase: number | null = null;
    if (d.minPurchase?.trim()) {
      const n = parseMoney(d.minPurchase);
      if (n === null || Number.isNaN(n) || n <= 0 || n > MAX_MONEY) issue("minPurchase", "Escribí un monto mayor a $ 0 (o dejalo vacío).");
      else minPurchase = n;
    }

    return {
      id: d.id,
      code: d.code,
      kind: d.kind,
      value,
      startsOn,
      endsOn,
      maxUses,
      minPurchase,
      onePerCustomer: d.onePerCustomer,
      isActive: d.isActive,
    };
  });

export type CouponFormInput = z.input<typeof couponFormSchema>;
export type CouponFormData = z.output<typeof couponFormSchema>;
