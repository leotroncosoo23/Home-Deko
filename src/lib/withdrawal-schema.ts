import { z } from "zod";
import { nameSchema } from "@/lib/checkout-schema";

/**
 * Formulario del BOTÓN DE ARREPENTIMIENTO (/arrepentimiento).
 * Se valida en el navegador (aviso al instante) y otra vez en el servidor.
 * La base vuelve a validar todo (create_withdrawal_request).
 *
 * Disposición 954/2025: sin registración ni trámites extra. Por eso solo se
 * piden nombre y email; el número de pedido y el motivo son opcionales.
 */

export const WITHDRAWAL_REASON_MAX = 1000;

export const withdrawalSchema = z.object({
  fullName: nameSchema,
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(254, "El email es demasiado largo.")
    .pipe(z.email("Revisá el email: parece que falta algo.")),
  // "#1024" o "1024" → "1024". Vacío = no lo sabe (está bien).
  orderNumber: z
    .string()
    .transform((v) => v.replace(/[#\s]/g, ""))
    .refine((v) => v === "" || /^\d{1,12}$/.test(v), { message: "Escribí solo el número (por ejemplo, 1024)." }),
  reason: z
    .string()
    .trim()
    .max(WITHDRAWAL_REASON_MAX, `Hasta ${WITHDRAWAL_REASON_MAX} caracteres.`),
});

export type WithdrawalInput = z.input<typeof withdrawalSchema>;
export type WithdrawalField = keyof WithdrawalInput;
export type WithdrawalFieldErrors = Partial<Record<WithdrawalField, string>>;

export const WITHDRAWAL_FIELDS: WithdrawalField[] = ["fullName", "email", "orderNumber", "reason"];

export function withdrawalFieldErrors(error: z.ZodError): WithdrawalFieldErrors {
  const out: WithdrawalFieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path[0] as WithdrawalField | undefined;
    if (key && !out[key]) out[key] = issue.message;
  }
  return out;
}

/** Lo que devuelve la Server Action. */
export type WithdrawalResult =
  | { ok: true; code: string; email: string }
  | { ok: false; error: string; fieldErrors?: WithdrawalFieldErrors };
