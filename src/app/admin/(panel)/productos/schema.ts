import { z } from "zod";
import { SLUG_MAX_LENGTH, SLUG_PATTERN } from "@/lib/slug";

/**
 * Validación del producto con zod.
 *
 * zod describe "cómo tiene que ser" un dato y lo comprueba. Se usa el MISMO
 * esquema en dos lugares:
 *   - en el navegador, para marcar los errores antes de enviar;
 *   - en el servidor (Server Action), porque nunca se confía en el navegador.
 */

const MAX_MONEY = 99_999_999.99;
const MAX_STOCK = 1_000_000;

const money = z
  .number({ error: "Ingresá un monto válido (ej.: 12.500 o 12.500,50)." })
  .min(0, "No puede ser negativo.")
  .max(MAX_MONEY, "El monto es demasiado grande.");

const quantity = z
  .number({ error: "Ingresá un número entero (ej.: 10)." })
  .int("Ingresá un número entero (ej.: 10).")
  .min(0, "No puede ser negativo.")
  .max(MAX_STOCK, "El número es demasiado grande.");

const optionValueSchema = z.object({
  key: z.string().min(1),
  id: z.uuid().nullable(),
  value: z.string().trim().min(1, "El valor no puede estar vacío.").max(60, "Máximo 60 caracteres."),
  colorHex: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Color inválido.")
    .nullable(),
});

const optionSchema = z.object({
  id: z.uuid().nullable(),
  name: z.string().trim().min(1, "Escribí el nombre de la opción.").max(40, "Máximo 40 caracteres."),
  values: z.array(optionValueSchema).min(1, "Agregá al menos un valor.").max(50, "Máximo 50 valores."),
});

const variantSchema = z.object({
  id: z.uuid().nullable(),
  valueKeys: z.array(z.string()),
  sku: z.string().trim().max(60, "Máximo 60 caracteres.").nullable(),
  price: money.nullable(),
  costPrice: money.nullable(),
  minStock: quantity,
  initialStock: quantity,
});

const imageSchema = z.object({
  storagePath: z.string().min(1).max(200),
  isPrimary: z.boolean(),
  colorValueKey: z.string().nullable(),
  altText: z.string().max(200),
});

const discountSchema = z.object({
  type: z.enum(["percent", "fixed"]),
  value: z.number({ error: "Ingresá un valor válido." }).positive("Tiene que ser mayor a 0."),
  /** ISO con zona horaria, o null. */
  startsAt: z.string().nullable(),
  endsAt: z.string().nullable(),
});

export const productInputSchema = z
  .object({
    id: z.uuid(),
    isNew: z.boolean(),
    expectedUpdatedAt: z.string().nullable(),
    name: z.string().trim().min(1, "Escribí un nombre.").max(120, "Máximo 120 caracteres."),
    slug: z
      .string()
      .min(1, "Escribí un slug.")
      .max(SLUG_MAX_LENGTH, `Máximo ${SLUG_MAX_LENGTH} caracteres.`)
      .regex(SLUG_PATTERN, "Solo minúsculas, números y guiones (ej.: taza-ceramica)."),
    description: z.string().max(5000, "Máximo 5000 caracteres."),
    categoryId: z.uuid().nullable(),
    basePrice: money,
    costPrice: money.nullable(),
    status: z.enum(["draft", "active", "archived"]),
    isFeatured: z.boolean(),
    hasVariants: z.boolean(),
    options: z.array(optionSchema).max(3, "Como máximo 3 opciones."),
    variants: z
      .array(variantSchema)
      .min(1, "Tiene que haber al menos una combinación.")
      .max(100, "Como máximo 100 combinaciones."),
    images: z.array(imageSchema).max(20, "Como máximo 20 imágenes."),
    discount: discountSchema.nullable(),
  })
  .superRefine((p, ctx) => {
    // Para publicar, todo lo que se vende tiene que tener precio.
    if (p.status === "active" && p.basePrice <= 0 && p.variants.some((v) => v.price === null || v.price <= 0)) {
      ctx.addIssue({
        code: "custom",
        path: ["basePrice"],
        message: "Para publicar, cargá un precio mayor a $ 0.",
      });
    }

    // Producto simple: una sola variante y ninguna opción.
    if (!p.hasVariants && (p.options.length > 0 || p.variants.length !== 1)) {
      ctx.addIssue({ code: "custom", path: ["variants"], message: "Un producto sin variantes tiene una sola variante." });
    }
    if (p.hasVariants && p.options.length === 0) {
      ctx.addIssue({ code: "custom", path: ["options"], message: "Agregá al menos una opción (ej.: Color)." });
    }

    // Nombres de opciones y valores sin repetir.
    const optionNames = new Set<string>();
    p.options.forEach((o, i) => {
      const name = o.name.trim().toLowerCase();
      if (optionNames.has(name)) {
        ctx.addIssue({ code: "custom", path: ["options", i, "name"], message: "Ya hay una opción con ese nombre." });
      }
      optionNames.add(name);
      const values = new Set<string>();
      o.values.forEach((v, j) => {
        const value = v.value.trim().toLowerCase();
        if (values.has(value)) {
          ctx.addIssue({ code: "custom", path: ["options", i, "values", j], message: `"${v.value}" está repetido.` });
        }
        values.add(value);
      });
    });

    // SKU sin repetir dentro del producto.
    const skus = new Map<string, number>();
    p.variants.forEach((v, i) => {
      if (!v.sku) return;
      const sku = v.sku.toUpperCase();
      if (skus.has(sku)) {
        ctx.addIssue({ code: "custom", path: ["variants", i, "sku"], message: "Este SKU está repetido." });
      }
      skus.set(sku, i);
    });

    // Descuento: porcentaje hasta 100; monto fijo menor al precio; fechas en orden.
    if (p.discount) {
      if (p.discount.type === "percent" && p.discount.value > 100) {
        ctx.addIssue({ code: "custom", path: ["discount", "value"], message: "El porcentaje va de 1 a 100." });
      }
      if (p.discount.type === "fixed" && p.basePrice > 0 && p.discount.value >= p.basePrice) {
        ctx.addIssue({ code: "custom", path: ["discount", "value"], message: "El descuento tiene que ser menor al precio." });
      }
      if (p.discount.startsAt && p.discount.endsAt && p.discount.endsAt <= p.discount.startsAt) {
        ctx.addIssue({ code: "custom", path: ["discount", "endsAt"], message: "La fecha de fin tiene que ser posterior a la de inicio." });
      }
    }
  });

export type ProductInput = z.infer<typeof productInputSchema>;

/** Convierte los errores de zod en { "name": "…", "variants.0.sku": "…" }. */
export function issuesToErrors(issues: z.core.$ZodIssue[]): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path.join(".") || "_form";
    if (!errors[key]) errors[key] = issue.message;
  }
  return errors;
}
