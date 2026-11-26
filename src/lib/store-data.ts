import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { BANNER_VIEW_COLUMNS, BANNERS_MAX, toBannerView, type BannerView } from "@/lib/banners";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CatalogSort } from "@/lib/catalog-params";
import type { Database } from "@/lib/database.types";
import { STORE_ANNOUNCEMENTS_TAG, STORE_BANNERS_TAG, STORE_CATEGORIES_TAG, STORE_PRODUCTS_TAG } from "@/lib/store-cache";
import { BEST_SELLERS_MIN, pickBestSellersOrFeatured, rankBestSellers } from "@/lib/best-sellers";
import { publicImageUrl } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { createPublicClient } from "@/lib/supabase/public";

/**
 * DATOS DE LA TIENDA, en caché ("use cache") y leídos como un visitante
 * (cliente público: solo ve lo que el RLS deja ver a "anon").
 *
 * Cómo se mantienen al día:
 *   - Al guardar en el panel, la Server Action llama a updateTag(...) con la
 *     etiqueta que corresponde (src/lib/store-cache.ts).
 *   - Lo que depende de la HORA se renueva solo con cacheLife:
 *       banner     → cada minuto ("minutes"): se prende y se apaga solo según sus fechas.
 *       productos  → cada hora ("hours"): los descuentos con fecha empiezan y terminan solos.
 *
 * Si una consulta falla, se tira un error (no se guarda en caché un dato vacío).
 */

// ---------------------------------------------------------------------------
// Categorías
// ---------------------------------------------------------------------------

export type StoreCategory = {
  id: string;
  name: string;
  slug: string;
  /** La que cargan en el panel (o null). Se usa como descripción para Google. */
  description: string | null;
  imageUrl: string | null;
  /**
   * Productos PUBLICADOS de la categoría. Se consulta como visitante, así que
   * el RLS ya deja afuera borradores y archivados. La barra de categorías
   * del escritorio solo muestra las que tienen al menos uno.
   */
  productCount: number;
};

/** Categorías visibles, en el orden que eligieron en el panel. */
export async function getVisibleCategories(): Promise<StoreCategory[]> {
  "use cache";
  cacheTag(STORE_CATEGORIES_TAG);
  cacheLife("max");

  const { data, error } = await createPublicClient()
    .from("categories")
    .select("id, name, slug, description, image_path, products(count)")
    .eq("is_visible", true)
    .order("sort_order")
    .order("name");
  if (error) throw new Error("No se pudieron leer las categorías.");

  return data.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    description: c.description?.trim() || null,
    imageUrl: c.image_path ? publicImageUrl(c.image_path) : null,
    productCount: c.products[0]?.count ?? 0,
  }));
}

// ---------------------------------------------------------------------------
// Productos (vista store_products)
// ---------------------------------------------------------------------------

export type StoreProduct = {
  id: string;
  name: string;
  slug: string;
  /** Solo los admins reciben borradores (ver src/lib/store-viewer.ts). */
  isDraft: boolean;
  /** Precio sin descuento (el más bajo, si tiene variantes con distinto precio). */
  price: number;
  /** Precio a pagar hoy (con el descuento, si está vigente). */
  finalPrice: number;
  discountActive: boolean;
  /** Tiene variantes con distinto precio → se muestra "Desde". */
  hasPriceRange: boolean;
  inStock: boolean;
  imageUrl: string | null;
  imageAlt: string | null;
  /** Segunda foto: aparece al pasar el mouse por la tarjeta. */
  secondaryImageUrl: string | null;
  /**
   * Descuento vigente en %, redondeado (el de la variante que más ahorra),
   * o null si no hay descuento. Ej.: 10 → "-10%".
   */
  discountPercent: number | null;
  /** Las variantes ahorran distinto % (descuento de monto fijo) → "Hasta -20%". */
  discountPercentVaries: boolean;
  /** Quedan 1 o 2 unidades en total → "¡Últimas unidades!". */
  fewLeft: boolean;
  /** Cuántas variantes activas tiene (botón rápido: 1 → "Agregar", más → "Ver opciones"). */
  variantCount: number;
  /** La variante, si tiene UNA sola (la que suma "Agregar" de la tarjeta). */
  singleVariantId: string | null;
};

export const STORE_PRODUCT_COLUMNS =
  "id, name, slug, status, min_price, final_min_price, discount_active, has_price_range, in_stock, primary_image_path, primary_image_alt, secondary_image_path, discount_percent_max, discount_percent_min, few_left, variant_count, single_variant_id";

type StoreProductRow = {
  id: string | null;
  name: string | null;
  slug: string | null;
  status: string | null;
  min_price: number | null;
  final_min_price: number | null;
  discount_active: boolean | null;
  has_price_range: boolean | null;
  in_stock: boolean | null;
  primary_image_path: string | null;
  primary_image_alt: string | null;
  secondary_image_path: string | null;
  discount_percent_max: number | null;
  discount_percent_min: number | null;
  few_left: boolean | null;
  variant_count: number | null;
  single_variant_id: string | null;
};

/** Fila de la vista → producto para la tarjeta. */
export function toStoreProduct(p: StoreProductRow): StoreProduct {
  const price = Number(p.min_price ?? 0);
  return {
    id: p.id ?? "",
    name: p.name ?? "",
    slug: p.slug ?? "",
    isDraft: p.status === "draft",
    price,
    finalPrice: Number(p.final_min_price ?? price),
    discountActive: Boolean(p.discount_active),
    hasPriceRange: Boolean(p.has_price_range),
    inStock: Boolean(p.in_stock),
    imageUrl: p.primary_image_path ? publicImageUrl(p.primary_image_path) : null,
    imageAlt: p.primary_image_alt,
    secondaryImageUrl: p.secondary_image_path ? publicImageUrl(p.secondary_image_path) : null,
    // Un descuento que redondea a 0 % no se anuncia como porcentaje.
    discountPercent: p.discount_percent_max && p.discount_percent_max > 0 ? p.discount_percent_max : null,
    discountPercentVaries:
      p.discount_percent_max != null &&
      p.discount_percent_min != null &&
      p.discount_percent_max !== p.discount_percent_min,
    fewLeft: Boolean(p.few_left) && Boolean(p.in_stock),
    variantCount: p.variant_count ?? 0,
    singleVariantId: p.single_variant_id,
  };
}

// ---------------------------------------------------------------------------
// Tiras del inicio: Novedades, Ofertas y Más vendidos (o Destacados)
//
// Solo productos CON STOCK: una tira que vende no ofrece agotados. Son las
// mismas para todos (también para los admins): así salen de la caché y el
// inicio carga rápido. Los borradores se revisan en el catálogo.
// ---------------------------------------------------------------------------

/** Productos por tira (2 filas de 4 en PC; en el celular se desliza). */
export const HOME_STRIP_LIMIT = 8;

/** Novedades: los últimos productos publicados con stock. */
export async function getNewArrivals(): Promise<StoreProduct[]> {
  "use cache";
  cacheTag(STORE_PRODUCTS_TAG);
  cacheLife("hours");

  const { data, error } = await createPublicClient()
    .from("store_products")
    .select(STORE_PRODUCT_COLUMNS)
    .eq("in_stock", true)
    .order("created_at", { ascending: false })
    .order("id")
    .limit(HOME_STRIP_LIMIT);
  if (error) throw new Error("No se pudieron leer las novedades.");

  return data.map(toStoreProduct);
}

/** Ofertas: productos con descuento vigente y stock (los más nuevos primero). */
export async function getOnSaleProducts(): Promise<StoreProduct[]> {
  "use cache";
  cacheTag(STORE_PRODUCTS_TAG);
  // Cada hora: los descuentos con fecha empiezan y terminan solos.
  cacheLife("hours");

  const { data, error } = await createPublicClient()
    .from("store_products")
    .select(STORE_PRODUCT_COLUMNS)
    .eq("in_stock", true)
    .eq("discount_active", true)
    .order("created_at", { ascending: false })
    .order("id")
    .limit(HOME_STRIP_LIMIT);
  if (error) throw new Error("No se pudieron leer las ofertas.");

  return data.map(toStoreProduct);
}

export type BestSellersStrip = { kind: "best" | "featured"; products: StoreProduct[] };

/**
 * Más vendidos: unidades de los pedidos PAGADOS (aprobados y no cancelados).
 * Con menos de 4 productos vendidos (que sigan publicados y con stock), la
 * tira muestra los Destacados con ese título (ver src/lib/best-sellers.ts).
 *
 * Si leer las ventas FALLA (base caída, o falta SUPABASE_SECRET_KEY, como en
 * un deploy de Preview sin esa variable), el inicio no se cae: la tira muestra
 * los Destacados.
 *
 * Ojo: un error tirado ADENTRO de una función "use cache" hace fallar el build
 * (y el render) aunque afuera haya un try/catch. Por eso las dos piezas de las
 * ventas nunca tiran: si fallan devuelven null, y ese null queda en caché
 * apenas un minuto (cacheLife("minutes")), así se vuelve a intentar enseguida.
 */
export async function getBestSellersStrip(): Promise<BestSellersStrip> {
  let bestSellers: StoreProduct[] = [];
  const rankedIds = await getSoldProductRanking();
  if (rankedIds && rankedIds.length >= BEST_SELLERS_MIN) {
    bestSellers = (await getProductsInSalesOrder(rankedIds.slice(0, 200))) ?? [];
  }

  const featured = bestSellers.length < BEST_SELLERS_MIN ? await getFeaturedInStock() : [];
  return pickBestSellersOrFeatured(bestSellers, featured, HOME_STRIP_LIMIT);
}

/** Un fallo de las piezas de "Más vendidos": se avisa en el log y se cachea poco. */
function bestSellersFailed(error: unknown): null {
  cacheLife("minutes");
  // Solo el mensaje (nunca claves ni datos de pedidos): queda en los logs del servidor.
  console.error(
    "[inicio] No se pudieron leer los más vendidos; se muestran los Destacados.",
    error instanceof Error ? error.message : String(error),
  );
  return null;
}

/**
 * Ids de los productos vendidos, del más vendido al menos vendido (null si falla).
 *
 * Los pedidos no los puede leer un visitante: se leen con la clave secreta
 * (createAdminClient), pero de acá solo sale el id de cada producto. Ningún
 * dato de clientes llega a la página.
 */
async function getSoldProductRanking(): Promise<string[] | null> {
  "use cache";
  cacheTag(STORE_PRODUCTS_TAG);
  // Las ventas aprobadas también llaman a revalidateTag(STORE_PRODUCTS_TAG) (por el stock).
  cacheLife("hours");

  try {
    const { data, error } = await createAdminClient()
      .from("order_items")
      .select("product_id, quantity, orders!inner(payment_status, fulfillment_status)")
      .eq("orders.payment_status", "approved")
      .neq("orders.fulfillment_status", "cancelled")
      .not("product_id", "is", null);
    if (error) throw new Error("No se pudieron leer las ventas.");
    return rankBestSellers(data);
  } catch (error) {
    return bestSellersFailed(error);
  }
}

/** Esos productos, si hoy se pueden comprar (publicados y con stock), en el mismo orden (null si falla). */
async function getProductsInSalesOrder(rankedIds: string[]): Promise<StoreProduct[] | null> {
  "use cache";
  cacheTag(STORE_PRODUCTS_TAG);
  cacheLife("hours");

  try {
    const { data, error } = await createPublicClient()
      .from("store_products")
      .select(STORE_PRODUCT_COLUMNS)
      .in("id", rankedIds)
      .eq("in_stock", true);
    if (error) throw new Error("No se pudieron leer los productos más vendidos.");

    const position = new Map(rankedIds.map((id, i) => [id, i]));
    return data.map(toStoreProduct).sort((a, b) => (position.get(a.id) ?? 0) - (position.get(b.id) ?? 0));
  } catch (error) {
    return bestSellersFailed(error);
  }
}

/** Destacados con stock (la tira cuando todavía no hay 4 productos vendidos). */
async function getFeaturedInStock(): Promise<StoreProduct[]> {
  "use cache";
  cacheTag(STORE_PRODUCTS_TAG);
  cacheLife("hours");

  const { data, error } = await createPublicClient()
    .from("store_products")
    .select(STORE_PRODUCT_COLUMNS)
    .eq("is_featured", true)
    .eq("in_stock", true)
    .order("created_at", { ascending: false })
    .order("id")
    .limit(HOME_STRIP_LIMIT);
  if (error) throw new Error("No se pudieron leer los productos destacados.");

  return data.map(toStoreProduct);
}

// ---------------------------------------------------------------------------
// Catálogo: /productos, /categorias/[slug] y /buscar
// ---------------------------------------------------------------------------

export type CatalogQuery = {
  categoryId: string | null;
  /** Ya normalizada con normalizeSearch() (minúsculas, sin tildes). Vacía = sin búsqueda. */
  search: string;
  orden: CatalogSort;
  min: number | null;
  max: number | null;
  /** Solo productos con descuento vigente (/productos?ofertas=1). */
  onSale: boolean;
  /** Cuántos productos traer desde el principio (PAGE_SIZE × tandas). */
  limit: number;
};

export type CatalogResult = {
  products: StoreProduct[];
  /** Cuántos productos hay en total con estos filtros (para "Ver más"). */
  total: number;
};

/** Escapa los comodines de LIKE (% y _): se buscan como texto. */
function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

/**
 * La consulta del catálogo, con el cliente que corresponda (visitante o
 * admin). Todo se filtra, ordena y corta EN LA BASE: funciona igual con
 * 50 productos que con 5.000.
 */
export async function queryCatalog(
  supabase: SupabaseClient<Database>,
  q: CatalogQuery,
): Promise<CatalogResult> {
  let query = supabase.from("store_products").select(STORE_PRODUCT_COLUMNS, { count: "exact" });

  if (q.categoryId) query = query.eq("category_id", q.categoryId);
  if (q.min !== null) query = query.gte("final_min_price", q.min);
  if (q.max !== null) query = query.lte("final_min_price", q.max);
  if (q.onSale) query = query.eq("discount_active", true);

  // Cada palabra tiene que aparecer (en cualquier orden): "sabana blanca"
  // encuentra "Sábana de algodón blanca".
  const words = q.search.split(/\s+/).filter(Boolean).slice(0, 6);
  for (const word of words) query = query.ilike("search_text", `%${escapeLike(word)}%`);

  // "Sin stock, sin venta": los agotados siempre al final, en cualquier orden.
  query = query.order("in_stock", { ascending: false });
  switch (q.orden) {
    case "destacados":
      query = query.order("is_featured", { ascending: false }).order("created_at", { ascending: false });
      break;
    case "nuevos":
      query = query.order("created_at", { ascending: false });
      break;
    case "menor-precio":
      query = query.order("final_min_price", { ascending: true });
      break;
    case "mayor-precio":
      query = query.order("final_min_price", { ascending: false });
      break;
  }
  // Desempate fijo: así "Ver más" nunca repite ni saltea productos.
  query = query.order("id");

  const { data, error, count } = await query.range(0, q.limit - 1);
  if (error) throw new Error("No se pudieron leer los productos.");

  return { products: data.map(toStoreProduct), total: count ?? data.length };
}

/** El catálogo que ve un visitante (solo publicados), en caché hasta que cambie algo. */
export async function getPublishedCatalog(q: CatalogQuery): Promise<CatalogResult> {
  "use cache";
  cacheTag(STORE_PRODUCTS_TAG);
  cacheLife("hours");

  return queryCatalog(createPublicClient(), q);
}

/** Una categoría visible por su slug (o null si no existe o está oculta). */
export async function getVisibleCategoryBySlug(slug: string): Promise<StoreCategory | null> {
  const categories = await getVisibleCategories();
  return categories.find((c) => c.slug === slug) ?? null;
}

// ---------------------------------------------------------------------------
// Página de producto: /productos/[slug]
// ---------------------------------------------------------------------------

export type ProductOptionValue = { id: string; value: string; colorHex: string | null };
export type ProductOption = { id: string; name: string; values: ProductOptionValue[] };

export type ProductVariant = {
  id: string;
  /** Sin descuento. */
  price: number;
  /** A pagar hoy (con el descuento vigente). De la vista store_variants. */
  finalPrice: number;
  /**
   * Unidades disponibles. No se muestra nunca: solo pone el tope del
   * selector de cantidad (el dato ya es público por la API de todos modos).
   */
  stock: number;
  /** Un valor por opción ("Rojo" y "30 cm"). Vacío en la variante por defecto. */
  optionValueIds: string[];
};

export type ProductPhoto = {
  url: string;
  alt: string | null;
  /** La foto es de un color (o valor) en particular; null = foto general. */
  optionValueId: string | null;
};

export type ProductDetail = {
  /** Los mismos datos que la tarjeta (precio "desde", descuento, etiquetas…). */
  card: StoreProduct;
  description: string | null;
  category: { id: string; name: string; slug: string } | null;
  /** Solo las opciones y valores que usa alguna variante activa. */
  options: ProductOption[];
  variants: ProductVariant[];
  photos: ProductPhoto[];
};

/**
 * Un producto completo para su página, con el cliente que corresponda
 * (visitante o admin). Primero se busca en store_products: si no está ahí
 * (borrador para un visitante, archivado o con la categoría oculta), no
 * existe para la tienda → null (404).
 */
export async function queryProduct(
  supabase: SupabaseClient<Database>,
  slug: string,
): Promise<ProductDetail | null> {
  const { data: row, error } = await supabase
    .from("store_products")
    .select(`${STORE_PRODUCT_COLUMNS}, category_id`)
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error("No se pudo leer el producto.");
  if (!row?.id) return null;
  const productId = row.id;

  const [product, category, options, variants, images] = await Promise.all([
    supabase.from("products").select("description").eq("id", productId).single(),
    row.category_id
      ? supabase.from("categories").select("id, name, slug").eq("id", row.category_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from("product_options")
      .select("id, name, position, product_option_values(id, value, color_hex, position)")
      .eq("product_id", productId)
      .order("position"),
    supabase
      .from("store_variants")
      .select("variant_id, price, final_price, stock, position")
      .eq("product_id", productId)
      .order("position"),
    supabase
      .from("product_images")
      .select("storage_path, alt_text, option_value_id")
      .eq("product_id", productId)
      .order("is_primary", { ascending: false })
      .order("position"),
  ]);
  if (product.error || category.error || options.error || variants.error || images.error) {
    throw new Error("No se pudo leer el producto.");
  }

  const variantIds = variants.data.flatMap((v) => (v.variant_id ? [v.variant_id] : []));
  const links = variantIds.length
    ? await supabase.from("variant_option_values").select("variant_id, option_value_id").in("variant_id", variantIds)
    : { data: [], error: null };
  if (links.error) throw new Error("No se pudo leer el producto.");

  const valuesByVariant = new Map<string, string[]>();
  for (const l of links.data) {
    valuesByVariant.set(l.variant_id, [...(valuesByVariant.get(l.variant_id) ?? []), l.option_value_id]);
  }
  const usedValues = new Set(links.data.map((l) => l.option_value_id));

  return {
    card: toStoreProduct(row),
    description: product.data.description?.trim() || null,
    category: category.data,
    options: options.data
      .map((o) => ({
        id: o.id,
        name: o.name,
        values: [...o.product_option_values]
          .sort((a, b) => a.position - b.position)
          .filter((v) => usedValues.has(v.id))
          .map((v) => ({ id: v.id, value: v.value, colorHex: v.color_hex })),
      }))
      .filter((o) => o.values.length > 0),
    variants: variants.data.map((v) => ({
      id: v.variant_id ?? "",
      price: Number(v.price ?? 0),
      finalPrice: Number(v.final_price ?? v.price ?? 0),
      stock: v.stock ?? 0,
      optionValueIds: valuesByVariant.get(v.variant_id ?? "") ?? [],
    })),
    photos: images.data.map((i) => ({
      url: publicImageUrl(i.storage_path),
      alt: i.alt_text,
      optionValueId: i.option_value_id,
    })),
  };
}

/** El producto que ve un visitante (solo publicados), en caché hasta que cambie algo. */
export async function getPublishedProduct(slug: string): Promise<ProductDetail | null> {
  "use cache";
  cacheTag(STORE_PRODUCTS_TAG);
  // Cada hora: los descuentos con fecha empiezan y terminan solos.
  cacheLife("hours");

  return queryProduct(createPublicClient(), slug);
}

/** Slugs de los productos publicados (para armar sus páginas de antemano). */
export async function getPublishedProductSlugs(): Promise<string[]> {
  "use cache";
  cacheTag(STORE_PRODUCTS_TAG);
  cacheLife("hours");

  const { data, error } = await createPublicClient().from("store_products").select("slug");
  if (error) throw new Error("No se pudieron leer los productos.");
  return data.flatMap((p) => (p.slug ? [p.slug] : []));
}

/** Cuántos "Productos relacionados" se muestran (una fila de 4 en PC, 2 de 2 en el celular). */
export const RELATED_LIMIT = 4;

/** Otros productos publicados de la misma categoría (los que tienen stock primero). */
export async function getRelatedProducts(categoryId: string, excludeId: string): Promise<StoreProduct[]> {
  "use cache";
  cacheTag(STORE_PRODUCTS_TAG);
  cacheLife("hours");

  const { data, error } = await createPublicClient()
    .from("store_products")
    .select(STORE_PRODUCT_COLUMNS)
    .eq("category_id", categoryId)
    .neq("id", excludeId)
    .order("in_stock", { ascending: false })
    .order("is_featured", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(RELATED_LIMIT);
  if (error) throw new Error("No se pudieron leer los productos relacionados.");

  return data.map(toStoreProduct);
}

// ---------------------------------------------------------------------------
// Banner principal
// ---------------------------------------------------------------------------

/**
 * Los banners que se ven hoy, en el orden del panel (banners.position).
 * El RLS ya filtra los activos y dentro de sus fechas. Vacío → banner de
 * Home Deko por defecto; 1 → fijo; 2 o 3 → carrusel.
 */
export async function getActiveBanners(): Promise<BannerView[]> {
  "use cache";
  cacheTag(STORE_BANNERS_TAG);
  cacheLife("minutes");

  const { data, error } = await createPublicClient()
    .from("banners")
    .select(BANNER_VIEW_COLUMNS)
    .order("position")
    .limit(BANNERS_MAX);
  if (error) throw new Error("No se pudieron leer los banners.");

  return data.map(toBannerView);
}

// ---------------------------------------------------------------------------
// Barra de anuncios
// ---------------------------------------------------------------------------

/** Mensajes de la barra de anuncios, en orden (hasta 4; vacío = no hay barra). */
export async function getAnnouncements(): Promise<string[]> {
  "use cache";
  cacheTag(STORE_ANNOUNCEMENTS_TAG);
  cacheLife("max");

  const { data, error } = await createPublicClient()
    .from("store_announcements")
    .select("text")
    .order("position");
  if (error) throw new Error("No se pudo leer la barra de anuncios.");

  return data.map((a) => a.text);
}
