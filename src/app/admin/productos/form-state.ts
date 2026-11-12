import { parseInteger, parseMoney } from "@/lib/format";
import type { ProductInput } from "./schema";
import type { FormDiscount, FormOption, FormVariant, ProductFormValues, ProductStatus } from "./types";

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
    excludedKeys: [],
    savedVariants: [],
    stashedSimple: null,
    stashedVariants: null,
  };
}

// ---------------------------------------------------------------------
// Variantes (parte 5B)
// ---------------------------------------------------------------------

/** Clave provisoria para opciones y valores nuevos (todavía sin id). */
export function newKey(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

/** Clave de una combinación: no depende del orden ("a|b" = "b|a"). */
export function combinationKey(valueKeys: string[]): string {
  return [...valueKeys].sort().join("|");
}

/**
 * Todas las combinaciones posibles, en orden. Ej.: Color {Rojo, Negro} ×
 * Medida {300, 500} → [Rojo,300] [Rojo,500] [Negro,300] [Negro,500].
 * Las opciones sin valores todavía se saltean.
 */
export function allCombinations(options: FormOption[]): string[][] {
  return options
    .filter((o) => o.values.length > 0)
    .reduce<string[][]>(
      (combos, option) => combos.flatMap((combo) => option.values.map((v) => [...combo, v.key])),
      [[]],
    )
    .filter((combo) => combo.length > 0);
}

/**
 * Rearma la tabla de combinaciones después de cambiar las opciones.
 * Lo que ya estaba cargado en una combinación (stock, precio, SKU…) se
 * conserva; las nuevas aparecen vacías; las quitadas a mano no vuelven.
 */
export function syncVariants(
  options: FormOption[],
  current: FormVariant[],
  excludedKeys: string[],
): FormVariant[] {
  const byKey = new Map(current.map((v) => [v.key, v]));
  const excluded = new Set(excludedKeys);
  return allCombinations(options)
    .map((valueKeys) => ({ valueKeys, key: combinationKey(valueKeys) }))
    .filter(({ key }) => !excluded.has(key))
    .map(({ valueKeys, key }) => {
      const existing = byKey.get(key);
      return existing ? { ...existing, valueKeys } : { ...defaultVariant(), key, valueKeys };
    });
}

/** Cuántas combinaciones daría (para avisar antes de pasar de 100). */
export function countCombinations(options: FormOption[]): number {
  const withValues = options.filter((o) => o.values.length > 0);
  return withValues.length === 0 ? 0 : withValues.reduce((n, o) => n * o.values.length, 1);
}

/** "Rojo / 300 ml" */
export function variantLabel(valueKeys: string[], options: FormOption[]): string {
  const names = new Map(options.flatMap((o) => o.values.map((v) => [v.key, v.value] as const)));
  return valueKeys.map((k) => names.get(k) ?? "?").join(" / ");
}

/** Muestra de color de una combinación (la del valor de la opción Color). */
export function variantColor(valueKeys: string[], options: FormOption[]): string | null {
  for (const o of options) {
    const v = o.values.find((x) => valueKeys.includes(x.key) && x.colorHex);
    if (v) return v.colorHex;
  }
  return null;
}

/**
 * SKU sugerido: nombre del producto + valores, en mayúsculas.
 * "Taza de cerámica" + Rojo / 300 ml → "TAZA-CERAMICA-ROJO-300ML"
 */
export function suggestSku(productName: string, valueNames: string[]): string {
  const clean = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toUpperCase()
      .replace(/[^A-Z0-9 ]+/g, " ")
      .trim();
  // Del nombre, las palabras con 3 letras o más (saca "de", "la"…), máximo 3.
  const base = clean(productName)
    .split(/\s+/)
    .filter((w) => w.length >= 3)
    .slice(0, 3)
    .join("-");
  // Cada valor junto: "300 ml" → "300ML"
  const parts = valueNames.map((v) => clean(v).replace(/\s+/g, ""));
  return [base || "PROD", ...parts].filter(Boolean).join("-").slice(0, 60);
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
