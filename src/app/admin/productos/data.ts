import "server-only";
import { requireAdmin } from "@/lib/auth";
import { formatMoneyInput } from "@/lib/format";
import { publicImageUrl } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";
import { defaultVariant, isoToArgentinaDay } from "./form-state";
import type {
  CategoryChoice,
  FormOption,
  FormVariant,
  ProductFormValues,
  ProductListItem,
  ProductStatus,
  VariantCode,
} from "./types";

/**
 * Lecturas de Productos para el panel. Todas arrancan con requireAdmin()
 * y se llaman dentro de <Suspense> (leen la sesión).
 */

/** Supabase devuelve las relaciones 1 a 1 como objeto (o a veces lista). */
function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

// ---------------------------------------------------------------------
// Categorías para el selector
// ---------------------------------------------------------------------
export async function getCategoryChoices(): Promise<CategoryChoice[]> {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, is_visible")
    .order("sort_order")
    .order("name");
  if (error) throw new Error("No se pudieron cargar las categorías.");
  return data.map((c) => ({ id: c.id, name: c.name, isVisible: c.is_visible }));
}

// ---------------------------------------------------------------------
// Lista mínima (el listado completo con filtros es el paso 6)
// ---------------------------------------------------------------------
export async function getProducts(): Promise<ProductListItem[]> {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select(
      `id, name, status, base_price, updated_at,
       categories ( name ),
       product_variants ( stock, min_stock, price, is_active, is_default ),
       product_images ( storage_path, is_primary )`,
    )
    .order("updated_at", { ascending: false })
    .limit(200);
  if (error) throw new Error("No se pudieron cargar los productos.");

  return data.map((p) => {
    const variants = p.product_variants.filter((v) => v.is_active);
    const prices = variants.map((v) => v.price ?? p.base_price);
    const primary = p.product_images.find((i) => i.is_primary) ?? p.product_images[0];
    return {
      id: p.id,
      name: p.name,
      status: p.status as ProductStatus,
      categoryName: one(p.categories)?.name ?? null,
      imageUrl: primary ? publicImageUrl(primary.storage_path) : null,
      basePrice: p.base_price,
      minPrice: prices.length ? Math.min(...prices) : p.base_price,
      maxPrice: prices.length ? Math.max(...prices) : p.base_price,
      variantCount: variants.length,
      hasVariants: !(variants.length === 1 && variants[0].is_default),
      totalStock: variants.reduce((sum, v) => sum + v.stock, 0),
      lowStock: variants.some((v) => v.stock <= v.min_stock),
    };
  });
}

// ---------------------------------------------------------------------
// Un producto para editar
// ---------------------------------------------------------------------
export type ProductForEdit = {
  values: ProductFormValues;
  codes: VariantCode[];
  name: string;
  status: ProductStatus;
  updatedAt: string;
};

export async function getProductForEdit(id: string): Promise<ProductForEdit | null> {
  await requireAdmin();
  const supabase = await createClient();
  const { data: p, error } = await supabase
    .from("products")
    .select(
      `id, name, slug, description, category_id, base_price, status, is_featured,
       discount_type, discount_value, discount_starts_at, discount_ends_at, updated_at,
       product_costs ( cost_price ),
       product_options ( id, name, position, product_option_values ( id, value, color_hex, position ) ),
       product_variants ( id, sku, barcode, price, stock, min_stock, is_default, is_active, position,
                          variant_costs ( cost_price ), variant_option_values ( option_value_id ) ),
       product_images ( storage_path, alt_text, position, is_primary, option_value_id )`,
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("No se pudo cargar el producto.");
  if (!p) return null;

  // Solo las variantes activas (las desactivadas guardan historial).
  const variants = p.product_variants
    .filter((v) => v.is_active)
    .sort((a, b) => a.position - b.position);
  const usedValueIds = new Set(variants.flatMap((v) => v.variant_option_values.map((l) => l.option_value_id)));
  const hasVariants = !(variants.length === 1 && variants[0].variant_option_values.length === 0);

  // Opciones y valores: solo los que usan las variantes activas (o que
  // todavía no usa ninguna variante, por si se cargaron sin combinaciones).
  const allLinked = new Set(
    p.product_variants.flatMap((v) => v.variant_option_values.map((l) => l.option_value_id)),
  );
  const options: FormOption[] = hasVariants
    ? p.product_options
        .sort((a, b) => a.position - b.position)
        .map((o) => ({
          key: o.id,
          id: o.id,
          name: o.name,
          values: o.product_option_values
            .filter((v) => usedValueIds.has(v.id) || !allLinked.has(v.id))
            .sort((a, b) => a.position - b.position)
            .map((v) => ({ key: v.id, id: v.id, value: v.value, colorHex: v.color_hex })),
        }))
        .filter((o) => o.values.length > 0)
    : [];

  // Nombre legible de cada valor, para las etiquetas "Rojo / 300 ml".
  const optionOrder = new Map(options.map((o, i) => [o.id, i]));
  const valueInfo = new Map(
    p.product_options.flatMap((o) =>
      o.product_option_values.map((v) => [v.id, { value: v.value, order: optionOrder.get(o.id) ?? 99 }] as const),
    ),
  );

  const formVariants: FormVariant[] = variants.map((v) => {
    const valueKeys = v.variant_option_values
      .map((l) => l.option_value_id)
      .sort((a, b) => (valueInfo.get(a)?.order ?? 0) - (valueInfo.get(b)?.order ?? 0));
    return {
      ...defaultVariant(),
      key: hasVariants ? [...valueKeys].sort().join("|") : "default",
      id: v.id,
      valueKeys,
      sku: v.sku ?? "",
      price: formatMoneyInput(v.price),
      costPrice: formatMoneyInput(one(v.variant_costs)?.cost_price ?? null),
      minStock: String(v.min_stock),
      stock: v.stock,
      barcode: v.barcode,
    };
  });

  const codes: VariantCode[] = variants.map((v) => ({
    id: v.id,
    label: hasVariants
      ? v.variant_option_values
          .map((l) => valueInfo.get(l.option_value_id))
          .filter((x) => x !== undefined)
          .sort((a, b) => a.order - b.order)
          .map((x) => x.value)
          .join(" / ")
      : "Única",
    sku: v.sku,
    barcode: v.barcode,
    stock: v.stock,
  }));

  const values: ProductFormValues = {
    id: p.id,
    isNew: false,
    expectedUpdatedAt: p.updated_at,
    name: p.name,
    slug: p.slug,
    description: p.description ?? "",
    categoryId: p.category_id,
    basePrice: formatMoneyInput(p.base_price),
    costPrice: formatMoneyInput(one(p.product_costs)?.cost_price ?? null),
    status: p.status as ProductStatus,
    isFeatured: p.is_featured,
    hasVariants,
    options,
    variants: formVariants.length ? formVariants : [defaultVariant()],
    images: p.product_images
      .sort((a, b) => a.position - b.position)
      // La principal primero (en la pantalla, la primera ES la principal)
      .sort((a, b) => Number(b.is_primary) - Number(a.is_primary))
      .map((img) => ({
        uid: img.storage_path,
        storagePath: img.storage_path,
        url: publicImageUrl(img.storage_path),
        previewUrl: null,
        uploading: false,
        error: null,
        // Solo si ese color sigue en las opciones que se muestran
        colorValueKey:
          img.option_value_id && options.some((o) => o.values.some((v) => v.key === img.option_value_id))
            ? img.option_value_id
            : null,
      })),
    excludedKeys: [],
    savedVariants: formVariants.map((v, i) => ({ ...v, savedLabel: codes[i]?.label })),
    stashedSimple: null,
    stashedVariants: null,
    discount:
      p.discount_type && p.discount_value !== null
        ? {
            type: p.discount_type,
            value: formatMoneyInput(p.discount_value),
            startsOn: isoToArgentinaDay(p.discount_starts_at),
            endsOn: isoToArgentinaDay(p.discount_ends_at),
          }
        : null,
  };

  return { values, codes, name: p.name, status: p.status as ProductStatus, updatedAt: p.updated_at };
}
