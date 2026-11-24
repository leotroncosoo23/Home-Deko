import "server-only";
import { requireAdmin } from "@/lib/auth";
import { formatMoneyInput } from "@/lib/format";
import { publicImageUrl } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/slug";
import { allCombinations, combinationKey, defaultVariant, isoToArgentinaDay } from "./form-state";
import { NO_CATEGORY, PAGE_SIZE, normalizeSearch, type ListParams, type SortKey } from "./list-params";
import type {
  CategoryChoice,
  FormOption,
  FormVariant,
  ProductFormValues,
  ProductListPage,
  ProductStatus,
  StockStatus,
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
// Listado (paso 6): filtros, orden y paginación sobre la vista
// admin_products (que ya trae el stock, los precios y la búsqueda
// calculados en la base).
// ---------------------------------------------------------------------
const LIST_COLUMNS =
  "id, name, status, category_name, primary_image_path, min_price, max_price, final_min_price, final_max_price, discount_active, variant_count, has_variants, total_stock, stock_status, has_history";

/** Qué columna y dirección usa cada orden. Al final, por id: orden estable entre páginas. */
const SORT_COLUMNS: Record<SortKey, { column: string; ascending: boolean }> = {
  recientes: { column: "updated_at", ascending: false },
  "nombre-asc": { column: "name", ascending: true },
  "nombre-desc": { column: "name", ascending: false },
  "precio-asc": { column: "final_min_price", ascending: true },
  "precio-desc": { column: "final_min_price", ascending: false },
  "stock-asc": { column: "total_stock", ascending: true },
  "stock-desc": { column: "total_stock", ascending: false },
};

export async function getProductList(params: ListParams): Promise<ProductListPage> {
  await requireAdmin();
  const supabase = await createClient();

  // Arma la consulta con los filtros. "countOnly": solo contar (sin traer filas).
  const filtered = (countOnly: boolean) => {
    // head: true = solo contar, sin traer las filas
    let query = supabase.from("admin_products").select(LIST_COLUMNS, { count: "exact", head: countOnly });

    // Estado
    if (params.estado === "activos") query = query.in("status", ["draft", "active"]);
    else if (params.estado === "publicados") query = query.eq("status", "active");
    else if (params.estado === "borradores") query = query.eq("status", "draft");
    else if (params.estado === "archivados") query = query.eq("status", "archived");

    // Categoría ("sin" = sin categoría)
    if (params.cat === NO_CATEGORY) query = query.is("category_id", null);
    else if (params.cat) query = query.eq("category_id", params.cat);

    // Stock
    if (params.stock === "bajo") query = query.eq("stock_status", "low");
    else if (params.stock === "sin") query = query.eq("stock_status", "out");

    // Búsqueda: cada palabra tiene que aparecer (en el nombre, un SKU o un
    // código de barras), en cualquier orden. "taza roja" = taza Y roja.
    const words = normalizeSearch(params.q).split(" ").filter(Boolean).slice(0, 6);
    for (const word of words) query = query.ilike("search_text", `%${word}%`);
    return query;
  };

  const run = (page: number) => {
    const sort = SORT_COLUMNS[params.orden];
    return filtered(false)
      .order(sort.column, { ascending: sort.ascending })
      .order("id")
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  };

  let page = params.pagina;
  let { data, count, error } = await run(page);
  // Si pidieron una página que no existe (ej.: archivaron los de la última,
  // o la URL es vieja), Supabase responde "rango no válido" (PGRST103):
  // se cuenta cuántos hay y se muestra la última página que sí existe.
  if (error?.code === "PGRST103" && page > 1) {
    const { count: total } = await filtered(true);
    page = Math.max(1, Math.ceil((total ?? 0) / PAGE_SIZE));
    ({ data, count, error } = await run(page));
  }
  if (error || !data) throw new Error("No se pudieron cargar los productos.");

  const total = count ?? 0;
  return {
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    // Las columnas de una vista llegan como "puede ser null": se completan.
    items: data.map((p) => ({
      id: p.id ?? "",
      name: p.name ?? "",
      status: (p.status ?? "draft") as ProductStatus,
      categoryName: p.category_name,
      imageUrl: p.primary_image_path ? publicImageUrl(p.primary_image_path) : null,
      minPrice: p.min_price ?? 0,
      maxPrice: p.max_price ?? 0,
      finalMinPrice: p.final_min_price ?? p.min_price ?? 0,
      finalMaxPrice: p.final_max_price ?? p.max_price ?? 0,
      discountActive: Boolean(p.discount_active),
      variantCount: p.variant_count ?? 0,
      hasVariants: Boolean(p.has_variants),
      totalStock: p.total_stock ?? 0,
      stockStatus: (p.stock_status ?? "ok") as StockStatus,
      hasHistory: Boolean(p.has_history),
    })),
  };
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

// ---------------------------------------------------------------------
// Duplicar (parte 5D)
// ---------------------------------------------------------------------

/**
 * Un producto existente como punto de partida para uno NUEVO: copia todo
 * menos el stock, los SKU, los códigos de barras y las fotos (esas son de
 * cada producto). Queda en Borrador, con "(copia)" en el nombre y un slug
 * libre.
 */
export async function getProductCopy(id: string): Promise<{ values: ProductFormValues; sourceName: string } | null> {
  const original = await getProductForEdit(id); // ya hace requireAdmin()
  if (!original) return null;
  const v = original.values;

  const name = `${v.name} (copia)`.slice(0, 120);
  const options = v.options.map((o) => ({
    ...o,
    id: null,
    values: o.values.map((val) => ({ ...val, id: null })),
  }));
  const variants = v.variants.map((variant) => ({
    ...variant,
    id: null,
    sku: "",
    initialStock: "",
    stock: null,
    barcode: null,
    savedLabel: undefined,
  }));
  // Las combinaciones que el original no tiene ("no existe Rojo / 500 ml")
  // se marcan como quitadas, para que la copia arranque igual.
  const present = new Set(variants.map((x) => x.key));
  const excludedKeys = v.hasVariants
    ? allCombinations(options).map(combinationKey).filter((key) => !present.has(key))
    : [];

  return {
    sourceName: v.name,
    values: {
      ...v,
      id: null,
      isNew: true,
      expectedUpdatedAt: null,
      name,
      slug: await freeSlug(slugify(`${v.slug}-copia`)),
      status: "draft",
      options,
      variants,
      images: [],
      excludedKeys,
      savedVariants: [],
      stashedSimple: null,
      stashedVariants: null,
    },
  };
}

/** "taza-copia" si está libre; si no, "taza-copia-2", "taza-copia-3"… */
async function freeSlug(slug: string): Promise<string> {
  // Dejar lugar para "-999" sin pasar el máximo de 80 caracteres
  const base = slug.slice(0, 76).replace(/-+$/, "");
  const supabase = await createClient();
  const { data } = await supabase.from("products").select("slug").like("slug", `${base}%`);
  const taken = new Set((data ?? []).map((p) => p.slug));
  if (!taken.has(base)) return base;
  for (let n = 2; n < 1000; n++) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${base}-${Date.now()}`;
}
