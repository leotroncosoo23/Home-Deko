import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import {
  getPublishedCatalog,
  getPublishedProduct,
  queryCatalog,
  queryProduct,
  type ProductDetail,
  type CatalogQuery,
  type CatalogResult,
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
 * Catálogo (todos, una categoría o una búsqueda) para quien está mirando:
 * los admins ven también los borradores.
 *
 *   - Visitante sin búsqueda → la versión en caché (igual para todos).
 *   - Visitante con búsqueda → como "anon", sin caché (cada búsqueda es
 *     distinta: guardarlas todas llenaría la caché de cosas que no se repiten).
 *   - Admin → con su sesión (el RLS le deja ver los borradores).
 */
export async function getCatalogForViewer(q: CatalogQuery): Promise<CatalogResult> {
  const viewer = await getStoreViewer();
  if (viewer.seesAdminView) return queryCatalog(await createClient(), q);
  if (q.search) return queryCatalog(createPublicClient(), q);
  return getPublishedCatalog(q);
}

/**
 * Página de un producto para quien está mirando: los admins (vista de
 * admin) pueden abrir también los borradores; el resto, la versión en caché.
 */
export async function getProductForViewer(slug: string): Promise<ProductDetail | null> {
  const viewer = await getStoreViewer();
  if (viewer.seesAdminView) return queryProduct(await createClient(), slug);
  return getPublishedProduct(slug);
}
