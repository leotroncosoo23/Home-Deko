import { z } from "zod";
import {
  APARTMENT_MAX,
  NOTES_MAX,
  POSTAL_CODE_ERROR,
  POSTAL_CODE_RE,
  PROVINCIAS,
  nameSchema,
  optionalText,
  phoneSchema,
} from "@/lib/checkout-schema";

/**
 * "Mis datos" de la cuenta del cliente: nombre, teléfono y una dirección de
 * envío guardada. Mismas reglas que el checkout (y que la base).
 *
 * Todo es opcional salvo el nombre. La dirección va completa o vacía: si
 * escribió algo de la dirección, se piden calle, ciudad, provincia y CP.
 */

/** Los datos tal como los usa el formulario (siempre texto, "" = vacío). */
export type AccountDetails = {
  name: string;
  phone: string;
  address: string;
  apartment: string;
  city: string;
  province: string;
  postalCode: string;
  notes: string;
};

export const EMPTY_DETAILS: AccountDetails = {
  name: "",
  phone: "",
  address: "",
  apartment: "",
  city: "",
  province: "",
  postalCode: "",
  notes: "",
};

export const accountDetailsSchema = z
  .object({
    name: nameSchema,
    // Vacío = no guardar teléfono.
    phone: z.union([z.string().trim().length(0), phoneSchema]),
    address: optionalText(200),
    apartment: optionalText(APARTMENT_MAX),
    city: optionalText(100),
    province: z.string().optional(),
    postalCode: optionalText(8),
    notes: optionalText(NOTES_MAX),
  })
  .superRefine((data, ctx) => {
    const anyAddress = [data.address, data.apartment, data.city, data.province, data.postalCode, data.notes].some(
      (v) => v && v.trim() !== "",
    );
    if (!anyAddress) return;
    if (!data.address || data.address.length < 4) {
      ctx.addIssue({ code: "custom", path: ["address"], message: "Escribí la calle y el número." });
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
  });

export type AccountFieldName = keyof AccountDetails;
export type AccountFieldErrors = Partial<Record<AccountFieldName, string>>;

export function accountFieldErrorsFrom(error: z.ZodError): AccountFieldErrors {
  const out: AccountFieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path[0] as AccountFieldName | undefined;
    if (key && !out[key]) out[key] = issue.message;
  }
  return out;
}

export type SaveDetailsResult = { ok: true } | { ok: false; error: string; fieldErrors?: AccountFieldErrors };

/** Datos validados → columnas de profiles ("" → null). */
export function detailsToProfileRow(d: z.output<typeof accountDetailsSchema>) {
  const orNull = (v: string | undefined) => (v && v.trim() !== "" ? v.trim() : null);
  return {
    full_name: d.name,
    phone: orNull(d.phone),
    ship_address: orNull(d.address),
    ship_apartment: orNull(d.apartment),
    ship_city: orNull(d.city),
    ship_province: orNull(d.province),
    ship_postal_code: d.postalCode ? d.postalCode.trim().toUpperCase() || null : null,
    ship_notes: orNull(d.notes),
  };
}
