import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import {
  FEATURED_LIMIT,
  getFeaturedProducts,
  getPublishedProducts,
  LIST_LIMIT,
  STORE_PRODUCT_COLUMNS,
  toStoreProduct,
  type StoreProduct,
} from "@/lib/store-data";
import { createPublicClient } from "@/lib/supabase/public";
import { createClient } from "@/lib/supabase/server";

/**
 * ¿QUIÉN ESTÁ MIRANDO LA TIENDA?
 *
 * Los dueños, con su sesión de admin, ven también los productos en
 * Borrador (con la etiqueta "Borrador") para revisar cómo quedan. Con el
 * botón "Ver como cliente" de la barra de arriba, la tienda se ve igual
 * que para un visitante.
 *
 * Seguridad: esto solo decide QUÉ se muestra. Que un cliente nunca vea un
 * borrador lo garantiza la base (RLS de products + vista store_products con
 * security_invoker): aunque alguien falsificara la cookie o el rol, la
 * consulta con su sesión solo le devolvería productos publicados.
 *
 * Lee cookies → usar SIEMPRE dentro de <Suspense>.
 */

/** Cookie de preferencia de "Ver como cliente". No da ni quita permisos. */
export const CUSTOMER_VIEW_COOKIE = "hd_vista";
export const CUSTOMER_VIEW_VALUE = "cliente";

export type StoreViewer = {
  /** Tiene sesión iniciada (cliente o admin). */
  hasSession: boolean;
  /** Tiene sesión de admin (rol que viene en el token, igual que el proxy). */
  isAdmin: boolean;
  /** El admin eligió "Ver como cliente". */
  customerView: boolean;
  /** isAdmin y NO está en "Ver como cliente": ve borradores y avisos para dueños. */
  seesAdminView: boolean;
};

/** cache() de React: el layout y la página la consultan una sola vez por pedido. */
export const getStoreViewer = cache(async (): Promise<StoreViewer> => {
  const supabase = await createClient();
  const cookieStore = await cookies();

  // getClaims() verifica la firma del token. El rol viaja adentro
  // (Custom Access Token Hook), así que no hace falta consultar la base.
  const { data } = await supabase.auth.getClaims();
  const isAdmin = data?.claims?.user_role === "admin";
  const customerView = cookieStore.get(CUSTOMER_VIEW_COOKIE)?.value === CUSTOMER_VIEW_VALUE;

  return { hasSession: Boolean(data?.claims), isAdmin, customerView, seesAdminView: isAdmin && !customerView };
});

/**
 * Destacados para quien está mirando:
 *   - admin (vista de admin) → con su sesión: publicados + borradores
 *   - cualquier otro         → la versión en caché, igual para todos
 */
export async function getFeaturedProductsForViewer(): Promise<StoreProduct[]> {
  const viewer = await getStoreViewer();
  if (!viewer.seesAdminView) return getFeaturedProducts();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("store_products")
    .select(STORE_PRODUCT_COLUMNS)
    .eq("is_featured", true)
    .order("created_at", { ascending: false })
    .limit(FEATURED_LIMIT);
  if (error) throw new Error("No se pudieron leer los productos destacados.");

  return data.map(toStoreProduct);
}

/**
 * Listado de productos (todos, de una categoría o una búsqueda por nombre)
 * para quien está mirando. Igual que los destacados: los admins ven
 * también los borradores.
 */
export async function getProductsForViewer({
  categoryId = null,
  search = "",
}: {
  categoryId?: string | null;
  search?: string;
}): Promise<StoreProduct[]> {
  const viewer = await getStoreViewer();
  const term = search.trim().slice(0, 80);

  // Visitante sin búsqueda: la versión en caché.
  if (!viewer.seesAdminView && !term) return getPublishedProducts(categoryId);

  // Admin: con su sesión (el RLS le deja ver los borradores).
  // Visitante con búsqueda: como "anon" (el RLS solo le deja ver publicados).
  const supabase = viewer.seesAdminView ? await createClient() : createPublicClient();
  let query = supabase.from("store_products").select(STORE_PRODUCT_COLUMNS);
  if (categoryId) query = query.eq("category_id", categoryId);
  if (term) {
    // Los comodines de LIKE (% y _) se escapan: se buscan como texto.
    query = query.ilike("name", `%${term.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`);
  }
  const { data, error } = await query.order("created_at", { ascending: false }).limit(LIST_LIMIT);
  if (error) throw new Error("No se pudieron leer los productos.");

  return data.map(toStoreProduct);
}
