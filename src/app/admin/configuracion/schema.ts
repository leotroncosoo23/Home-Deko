import { z } from "zod";
import { parseInteger, parseMoney } from "@/lib/format";

/**
 * Validación del formulario de Configuración. Se usa en el navegador (para
 * avisar al instante) y otra vez en el servidor (actions.ts), que no confía
 * en lo que manda el navegador.
 *
 * Además de validar, LIMPIA lo que escriben las personas:
 *   - WhatsApp "+54 9 2945 12-3456"            → "5492945123456"
 *   - Instagram "@homedeko.hogar" o el link     → "homedeko.hogar"
 *   - CUIT "20-12345678-6"                      → "20123456786"
 *   - Envío "20.000"                            → 20000
 */

export const SETTINGS_FIELDS = [
  "whatsapp",
  "instagram",
  "tiktok",
  "shippingCost",
  "storeAddress",
  "storeHours",
  "exchangeDays",
  "businessName",
  "cuit",
  "contactEmail",
] as const;

export type SettingsField = (typeof SETTINGS_FIELDS)[number];

/** Lo que se escribe en el formulario (todo texto). */
export type SettingsInput = Record<SettingsField, string>;

export const SHIPPING_MAX = 10_000_000;
export const EXCHANGE_DAYS_MAX = 365;

/** Saca el link, la "@" y espacios: queda solo el nombre de usuario. */
function cleanHandle(value: string) {
  return value
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^(www\.)?(instagram|tiktok)\.com\//i, "")
    .replace(/^@/, "")
    .replace(/[/?#].*$/, "");
}

/** Dígito verificador del CUIT/CUIL (algoritmo de ARCA, módulo 11). */
export function isValidCuit(digits: string) {
  if (!/^\d{11}$/.test(digits)) return false;
  const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const sum = weights.reduce((acc, w, i) => acc + w * Number(digits[i]), 0);
  const rest = 11 - (sum % 11);
  const check = rest === 11 ? 0 : rest === 10 ? 9 : rest;
  return check === Number(digits[10]);
}

const optionalText = (max: number) =>
  z.string().trim().max(max, `Máximo ${max} caracteres.`);

export const settingsSchema = z.object({
  whatsapp: z
    .string()
    .transform((v) => v.replace(/\D/g, ""))
    .refine((v) => v === "" || /^\d{10,15}$/.test(v), {
      message: "Escribí el número completo con el código de país (ej.: 5492945123456).",
    }),
  instagram: z
    .string()
    .transform(cleanHandle)
    .refine((v) => /^[A-Za-z0-9._]{0,30}$/.test(v), {
      message: "Solo el usuario: letras, números, puntos y guiones bajos (ej.: homedeko.hogar).",
    }),
  tiktok: z
    .string()
    .transform(cleanHandle)
    .refine((v) => /^[A-Za-z0-9._]{0,24}$/.test(v), {
      message: "Solo el usuario: letras, números, puntos y guiones bajos.",
    }),
  shippingCost: z
    .string()
    .transform((v) => parseMoney(v))
    .refine((v) => v !== null, { message: "Escribí el costo del envío (puede ser 0)." })
    .refine((v) => v === null || (!Number.isNaN(v) && v >= 0 && v <= SHIPPING_MAX), {
      message: "Escribí un monto válido (ej.: 20.000).",
    })
    .transform((v) => v as number),
  storeAddress: optionalText(200),
  storeHours: optionalText(300),
  exchangeDays: z
    .string()
    .transform((v) => parseInteger(v))
    .refine((v) => v !== null && !Number.isNaN(v) && v <= EXCHANGE_DAYS_MAX, {
      message: `Escribí una cantidad de días entre 0 y ${EXCHANGE_DAYS_MAX} (0 = no se aceptan cambios por gusto).`,
    })
    .transform((v) => v as number),
  businessName: optionalText(120),
  cuit: z
    .string()
    .transform((v) => v.replace(/\D/g, ""))
    .refine((v) => v === "" || isValidCuit(v), {
      message: "Revisá el CUIT: son 11 números (ej.: 20-12345678-6).",
    }),
  contactEmail: z
    .string()
    .trim()
    .toLowerCase()
    .refine((v) => v === "" || z.email().safeParse(v).success, {
      message: "Escribí un email válido (ej.: hola@homedeko.com).",
    })
    .refine((v) => v.length <= 254, { message: "El email es demasiado largo." }),
});

export type SettingsValues = z.output<typeof settingsSchema>;

/** Valida y devuelve los datos limpios, o un error por campo. */
export function validateSettings(
  input: SettingsInput,
): { ok: true; data: SettingsValues } | { ok: false; fieldErrors: Partial<Record<SettingsField, string>> } {
  const result = settingsSchema.safeParse(input);
  if (result.success) return { ok: true, data: result.data };

  const fieldErrors: Partial<Record<SettingsField, string>> = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0] as SettingsField;
    fieldErrors[field] ??= issue.message;
  }
  return { ok: false, fieldErrors };
}
