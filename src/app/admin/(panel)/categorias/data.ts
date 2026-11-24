import "server-only";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { publicImageUrl } from "@/lib/storage";
import type { Category } from "./types";

/**
 * Todas las categorías, en el orden de la tienda, con su cantidad de
 * productos. Solo para el panel: arranca con requireAdmin().
 *
 * Llamarla dentro de <Suspense> (lee la sesión del usuario).
 */
export async function getCategories(): Promise<Category[]> {
  await requireAdmin();
  const supabase = await createClient();

  // "products(count)" le pide a Supabase que cuente los productos de cada
  // categoría en la misma consulta (sin traerlos).
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, slug, is_visible, image_path, sort_order, products(count)")
    .order("sort_order")
    .order("name");

  if (error) throw new Error("No se pudieron cargar las categorías.");

  return data.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    isVisible: c.is_visible,
    imagePath: c.image_path,
    imageUrl: c.image_path ? publicImageUrl(c.image_path) : null,
    sortOrder: c.sort_order,
    productCount: c.products[0]?.count ?? 0,
  }));
}
