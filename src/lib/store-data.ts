import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { BANNER_VIEW_COLUMNS, toBannerView, type BannerView } from "@/lib/banners";
import { STORE_ANNOUNCEMENTS_TAG, STORE_BANNERS_TAG, STORE_CATEGORIES_TAG, STORE_PRODUCTS_TAG } from "@/lib/store-cache";
import { publicImageUrl } from "@/lib/storage";
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
    .select("id, name, slug, image_path, products(count)")
    .eq("is_visible", true)
    .order("sort_order")
    .order("name");
  if (error) throw new Error("No se pudieron leer las categorías.");

  return data.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
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
};

export const STORE_PRODUCT_COLUMNS =
  "id, name, slug, status, min_price, final_min_price, discount_active, has_price_range, in_stock, primary_image_path, primary_image_alt";

/** Cuántos destacados muestra el inicio (4 filas de 2 en el celular, 2 de 4 en PC). */
export const FEATURED_LIMIT = 8;

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
  };
}

/** Productos destacados que ve un visitante (solo publicados). */
export async function getFeaturedProducts(): Promise<StoreProduct[]> {
  "use cache";
  cacheTag(STORE_PRODUCTS_TAG);
  cacheLife("hours");

  const { data, error } = await createPublicClient()
    .from("store_products")
    .select(STORE_PRODUCT_COLUMNS)
    .eq("is_featured", true)
    .order("created_at", { ascending: false })
    .limit(FEATURED_LIMIT);
  if (error) throw new Error("No se pudieron leer los productos destacados.");

  return data.map(toStoreProduct);
}

/** Máximo de productos por listado (la paginación llega con el catálogo completo). */
export const LIST_LIMIT = 120;

/**
 * Productos publicados (todos o de una categoría), del más nuevo al más
 * viejo. Lo que ve un visitante; en caché hasta que cambie algo.
 */
export async function getPublishedProducts(categoryId: string | null): Promise<StoreProduct[]> {
  "use cache";
  cacheTag(STORE_PRODUCTS_TAG);
  cacheLife("hours");

  let query = createPublicClient().from("store_products").select(STORE_PRODUCT_COLUMNS);
  if (categoryId) query = query.eq("category_id", categoryId);
  const { data, error } = await query.order("created_at", { ascending: false }).limit(LIST_LIMIT);
  if (error) throw new Error("No se pudieron leer los productos.");

  return data.map(toStoreProduct);
}

/** Una categoría visible por su slug (o null si no existe o está oculta). */
export async function getVisibleCategoryBySlug(slug: string): Promise<StoreCategory | null> {
  const categories = await getVisibleCategories();
  return categories.find((c) => c.slug === slug) ?? null;
}

// ---------------------------------------------------------------------------
// Banner principal
// ---------------------------------------------------------------------------

/**
 * El banner que se ve hoy, o null (→ banner de Home Deko por defecto).
 * El RLS ya filtra los activos y dentro de sus fechas; si hay varios, gana
 * el que empezó más recientemente (los que no tienen fecha de inicio, al final).
 */
export async function getActiveBanner(): Promise<BannerView | null> {
  "use cache";
  cacheTag(STORE_BANNERS_TAG);
  cacheLife("minutes");

  const { data, error } = await createPublicClient()
    .from("banners")
    .select(BANNER_VIEW_COLUMNS)
    .order("starts_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error("No se pudo leer el banner.");

  return data ? toBannerView(data) : null;
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
