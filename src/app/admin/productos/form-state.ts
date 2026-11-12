import { parseInteger, parseMoney } from "@/lib/format";
import type { ProductInput } from "./schema";
import type { FormDiscount, FormVariant, ProductFormValues, ProductStatus } from "./types";

/**
 * Funciones "puras" del formulario de producto: reciben datos y devuelven
 * datos, sin tocar la pantalla. Así se pueden probar y reusar fácil.
 */

/** La variante única de un producto sin variantes. */
export function defaultVariant(): FormVariant {
  return {
    key: "default",
    id: null,
    valueKeys: [],
    sku: "",
    price: "",
    costPrice: "",
    minStock: "",
    initialStock: "",
    stock: null,
    barcode: null,
  };
}

/** Formulario vacío. "Guardar y cargar otro" conserva categoría y estado. */
export function emptyValues(keep?: { categoryId: string | null; status: ProductStatus }): ProductFormValues {
  return {
    id: null,
    isNew: true,
    expectedUpdatedAt: null,
    name: "",
    slug: "",
    description: "",
    categoryId: keep?.categoryId ?? null,
    basePrice: "",
    costPrice: "",
    status: keep?.status ?? "draft",
    isFeatured: false,
    hasVariants: false,
    options: [],
    variants: [defaultVariant()],
    images: [],
    discount: null,
  };
}

// ---------------------------------------------------------------------
// Fechas del descuento: el formulario usa días ("2026-12-01"); la base
// guarda instantes. "Desde" = 00:00 y "Hasta" = 23:59:59 de ese día, en
// hora de Argentina (UTC−3 todo el año, sin horario de verano).
// ---------------------------------------------------------------------
const AR_OFFSET = "-03:00";

export function dayStartToIso(day: string): string | null {
  return day ? `${day}T00:00:00${AR_OFFSET}` : null;
}

export function dayEndToIso(day: string): string | null {
  return day ? `${day}T23:59:59${AR_OFFSET}` : null;
}

/** Un instante → el día en Argentina ("2026-12-01"). */
export function isoToArgentinaDay(iso: string | null): string {
  if (!iso) return "";
  // "en-CA" escribe las fechas como AAAA-MM-DD.
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
}

function discountToInput(d: FormDiscount | null): ProductInput["discount"] {
  if (!d) return null;
  return {
    type: d.type,
    value: parseMoney(d.value) ?? NaN,
    startsAt: dayStartToIso(d.startsOn),
    endsAt: dayEndToIso(d.endsOn),
  };
}

/**
 * Del formulario (texto) a lo que viaja al servidor (números).
 * Los textos inválidos quedan como NaN, y zod los marca como error.
 */
export function toInput(values: ProductFormValues, id: string): ProductInput {
  const money = (s: string) => parseMoney(s);
  return {
    id,
    isNew: values.isNew,
    expectedUpdatedAt: values.expectedUpdatedAt,
    name: values.name.trim(),
    slug: values.slug.trim(),
    description: values.description.trim(),
    categoryId: values.categoryId,
    basePrice: money(values.basePrice) ?? 0,
    costPrice: money(values.costPrice),
    status: values.status,
    isFeatured: values.isFeatured,
    hasVariants: values.hasVariants,
    options: values.options.map((o) => ({
      id: o.id,
      name: o.name.trim(),
      values: o.values.map((v) => ({ key: v.key, id: v.id, value: v.value.trim(), colorHex: v.colorHex })),
    })),
    variants: values.variants.map((v) => ({
      id: v.id,
      valueKeys: v.valueKeys,
      sku: v.sku.trim() || null,
      price: money(v.price),
      costPrice: money(v.costPrice),
      minStock: parseInteger(v.minStock) ?? 0,
      initialStock: parseInteger(v.initialStock) ?? 0,
    })),
    images: values.images.map((img) => ({
      storagePath: img.storagePath,
      isPrimary: img.isPrimary,
      colorValueKey: img.colorValueKey,
      altText: img.altText,
    })),
    discount: discountToInput(values.discount),
  };
}
