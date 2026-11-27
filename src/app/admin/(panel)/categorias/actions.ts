"use server";

import { refresh, updateTag } from "next/cache";
import { STORE_CATEGORIES_TAG, STORE_PRODUCTS_TAG } from "@/lib/store-cache";
import { requireAdmin } from "@/lib/auth";
import { uniqueSlug } from "@/lib/categories";
import { createClient } from "@/lib/supabase/server";
import { slugify, SLUG_MAX_LENGTH, SLUG_PATTERN } from "@/lib/slug";
import { IMAGES_BUCKET } from "@/lib/storage";
import type { ActionResult, CategoryField } from "./types";

/**
 * Server Actions de Categorías (principales y subcategorías).
 *
 * Reglas para TODAS:
 *   1. Arrancan con requireAdmin() (rol leído de la base en el momento).
 *   2. No confían en el navegador: vuelven a validar todo acá.
 *   3. Invalidan la caché de la tienda (menú, mega menú, acordeón, chips,
 *      inicio y catálogo) con updateTag y terminan con refresh(), que
 *      vuelve a pedir la página para que el listado muestre lo nuevo.
 * Por debajo, el RLS de la base es la última barrera, y el trigger
 * categories_check_level garantiza un solo nivel de subcategorías.
 */

const NAME_MAX_LENGTH = 80;
const IMAGE_MAX_BYTES = 2 * 1024 * 1024; // ya llega comprimida (~100–300 KB)
const IMAGE_TYPES: Record<string, string> = {
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "image/png": "png",
};
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const GENERIC_ERROR = "No se pudo guardar. Intentá de nuevo en unos segundos.";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** La tienda (menú, árbol, chips, catálogo) vuelve a leer las categorías. */
function invalidateStore() {
  updateTag(STORE_CATEGORIES_TAG);
  // El nombre de la categoría está en el buscador, y ocultarla o moverla
  // cambia qué productos se ven: el catálogo también se actualiza.
  updateTag(STORE_PRODUCTS_TAG);
}

/** Errores del trigger de un solo nivel (23514) → mensaje para el diálogo. */
function levelError(message: string | undefined): string | null {
  if (message === "subcategoria_anidada") return "Elegí una categoría principal: las subcategorías no pueden tener subcategorías.";
  if (message === "categoria_con_hijas") return "Tiene subcategorías: no puede pasar a ser una subcategoría. Movelas primero.";
  return null;
}

/** Próximo sort_order dentro de su grupo (principales, o subcategorías de una principal). */
async function nextSortOrder(supabase: Supabase, parentId: string | null): Promise<number> {
  let query = supabase.from("categories").select("sort_order").order("sort_order", { ascending: false }).limit(1);
  query = parentId ? query.eq("parent_id", parentId) : query.is("parent_id", null);
  const { data } = await query.maybeSingle();
  return (data?.sort_order ?? 0) + 1;
}

// ---------------------------------------------------------------------
// Crear o editar
// ---------------------------------------------------------------------

/**
 * Crea (sin "id") o edita (con "id") una categoría.
 *
 * FormData: id?, name, slug, slugAuto ("true" si no lo tocaron: si ya
 *           existe, se usa slug-2, slug-3…), parentId ("" = principal),
 *           isVisible ("true"/"false"), image? (archivo ya comprimido),
 *           removeImage? ("true")
 *
 * La foto de portada es solo para principales: si pasa a ser subcategoría,
 * la foto se quita.
 */
export async function saveCategory(formData: FormData): Promise<ActionResult> {
  await requireAdmin();

  // --- 1. Leer y validar ---------------------------------------------
  const id = String(formData.get("id") ?? "").trim() || null;
  const name = String(formData.get("name") ?? "").trim();
  let slug = String(formData.get("slug") ?? "").trim().toLowerCase();
  const slugAuto = formData.get("slugAuto") === "true";
  const parentId = String(formData.get("parentId") ?? "").trim() || null;
  const isVisible = formData.get("isVisible") === "true";
  const removeImage = formData.get("removeImage") === "true";
  const imageEntry = formData.get("image");
  const image = parentId ? null : imageEntry instanceof File && imageEntry.size > 0 ? imageEntry : null;

  const fieldErrors: Partial<Record<CategoryField, string>> = {};
  if (!name) fieldErrors.name = "Escribí un nombre.";
  else if (name.length > NAME_MAX_LENGTH) fieldErrors.name = `Máximo ${NAME_MAX_LENGTH} caracteres.`;

  if (!slug) fieldErrors.slug = "Escribí un slug.";
  else if (slug.length > SLUG_MAX_LENGTH) fieldErrors.slug = `Máximo ${SLUG_MAX_LENGTH} caracteres.`;
  else if (!SLUG_PATTERN.test(slug))
    fieldErrors.slug = "Solo minúsculas, números y guiones (ej.: cocina-y-bano).";

  if (image) {
    if (!(image.type in IMAGE_TYPES)) fieldErrors.image = "La imagen tiene que ser JPG, PNG o WebP.";
    else if (image.size > IMAGE_MAX_BYTES) fieldErrors.image = "La imagen es demasiado pesada (máx. 2 MB).";
  }

  if (id && !UUID_PATTERN.test(id)) return { ok: false, error: "Categoría inválida." };
  if (parentId && !UUID_PATTERN.test(parentId)) return { ok: false, error: "Categoría principal inválida." };
  if (id && parentId === id) fieldErrors.parent = "Una categoría no puede pertenecer a sí misma.";
  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, error: "Revisá los datos marcados.", fieldErrors };
  }

  const supabase = await createClient();

  // --- 2. Si es edición, traer la categoría actual ---------------------
  let previousImagePath: string | null = null;
  let previousParentId: string | null = null;
  if (id) {
    const { data: current, error } = await supabase
      .from("categories")
      .select("image_path, parent_id")
      .eq("id", id)
      .maybeSingle();
    if (error) return { ok: false, error: GENERIC_ERROR };
    if (!current) return { ok: false, error: "Esta categoría ya no existe. Recargá la página." };
    previousImagePath = current.image_path;
    previousParentId = current.parent_id;
  }

  // Slug automático (al crear, sin tocarlo): si ya existe, uno libre.
  if (!id && slugAuto) {
    const { data: taken } = await supabase.from("categories").select("slug").like("slug", `${slug}%`);
    slug = uniqueSlug(slug, (taken ?? []).map((t) => t.slug));
  }

  // --- 3. Subir la imagen nueva (si hay; solo principales) -------------
  let uploadedPath: string | null = null;
  if (image) {
    // Nombre al azar: nunca pisa otro archivo y evita caché vieja.
    uploadedPath = `categories/${crypto.randomUUID()}.${IMAGE_TYPES[image.type]}`;
    const { error } = await supabase.storage
      .from(IMAGES_BUCKET)
      .upload(uploadedPath, image, { contentType: image.type, upsert: false });
    if (error) {
      return {
        ok: false,
        error: "No se pudo subir la imagen.",
        fieldErrors: { image: "No se pudo subir la imagen. Probá de nuevo." },
      };
    }
  }

  // Subcategoría → sin foto de portada.
  const imagePath = parentId ? null : (uploadedPath ?? (removeImage ? null : previousImagePath));

  // --- 4. Guardar en la base ------------------------------------------
  let dbError: { code: string; message: string } | null;
  if (id) {
    const update: {
      name: string;
      slug: string;
      parent_id: string | null;
      is_visible: boolean;
      image_path: string | null;
      sort_order?: number;
    } = { name, slug, parent_id: parentId, is_visible: isVisible, image_path: imagePath };
    // Cambió de grupo: va al final de su grupo nuevo.
    if (parentId !== previousParentId) update.sort_order = await nextSortOrder(supabase, parentId);
    ({ error: dbError } = await supabase.from("categories").update(update).eq("id", id));
  } else {
    ({ error: dbError } = await supabase.from("categories").insert({
      name,
      slug,
      parent_id: parentId,
      is_visible: isVisible,
      image_path: imagePath,
      sort_order: await nextSortOrder(supabase, parentId),
    }));
  }

  if (dbError) {
    // Si falló, borrar la imagen que acabamos de subir (no dejar basura).
    if (uploadedPath) await removeImageFile(uploadedPath);
    // 23505 = "unique violation": ese slug ya lo usa otra categoría.
    if (dbError.code === "23505") {
      return {
        ok: false,
        error: "Revisá los datos marcados.",
        fieldErrors: { slug: "Ya existe una categoría con ese slug." },
      };
    }
    const level = levelError(dbError.message);
    if (level) return { ok: false, error: "Revisá los datos marcados.", fieldErrors: { parent: level } };
    return { ok: false, error: GENERIC_ERROR };
  }

  // --- 5. Si la imagen cambió o se quitó, borrar la vieja -------------
  if (previousImagePath && previousImagePath !== imagePath) {
    await removeImageFile(previousImagePath);
  }

  invalidateStore();
  refresh();
  return { ok: true };
}

// ---------------------------------------------------------------------
// Crear una subcategoría desde el selector del producto
// ---------------------------------------------------------------------

export type QuickCategoryResult =
  | { ok: true; category: { id: string; name: string; parentId: string | null; isVisible: boolean } }
  | { ok: false; error: string };

/**
 * "+ Crear 'Termos' en Cocina" (selector de categoría del producto): crea
 * la subcategoría visible, con slug automático, al final de su principal.
 * No hace refresh(): el formulario del producto sigue abierto y no se pierde nada.
 */
export async function createSubcategory(name: string, parentId: string): Promise<QuickCategoryResult> {
  await requireAdmin();
  const clean = String(name ?? "").trim().replace(/\s+/g, " ");
  if (!clean) return { ok: false, error: "Escribí un nombre." };
  if (clean.length > NAME_MAX_LENGTH) return { ok: false, error: `Máximo ${NAME_MAX_LENGTH} caracteres.` };
  if (!UUID_PATTERN.test(String(parentId))) return { ok: false, error: "Elegí una categoría principal." };
  const base = slugify(clean);
  if (!base) return { ok: false, error: "Usá letras o números en el nombre." };

  const supabase = await createClient();
  const { data: parent } = await supabase.from("categories").select("id, parent_id").eq("id", parentId).maybeSingle();
  if (!parent) return { ok: false, error: "Esa categoría ya no existe. Recargá la página." };
  if (parent.parent_id) return { ok: false, error: "Elegí una categoría principal." };

  const { data: taken } = await supabase.from("categories").select("slug").like("slug", `${base}%`);
  const slug = uniqueSlug(base, (taken ?? []).map((t) => t.slug));

  const { data, error } = await supabase
    .from("categories")
    .insert({ name: clean, slug, parent_id: parentId, is_visible: true, sort_order: await nextSortOrder(supabase, parentId) })
    .select("id, name, parent_id, is_visible")
    .single();
  if (error || !data) {
    return { ok: false, error: levelError(error?.message) ?? "No se pudo crear. Intentá de nuevo en unos segundos." };
  }

  invalidateStore();
  return { ok: true, category: { id: data.id, name: data.name, parentId: data.parent_id, isVisible: data.is_visible } };
}

// ---------------------------------------------------------------------
// Mostrar / ocultar
// ---------------------------------------------------------------------

export async function setCategoryVisibility(id: string, isVisible: boolean): Promise<ActionResult> {
  await requireAdmin();
  if (!UUID_PATTERN.test(id)) return { ok: false, error: "Categoría inválida." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .update({ is_visible: isVisible })
    .eq("id", id)
    .select("id");

  if (error) return { ok: false, error: GENERIC_ERROR };
  if (data.length === 0) return { ok: false, error: "Esta categoría ya no existe. Recargá la página." };

  invalidateStore(); // ocultar la categoría esconde sus productos (y los de sus subcategorías)
  refresh();
  return { ok: true };
}

// ---------------------------------------------------------------------
// Eliminar (moviendo antes productos y subcategorías, si hay)
// ---------------------------------------------------------------------

export type DeletePlan = {
  /** A dónde van sus productos: id de otra categoría, o null = "Sin categoría". */
  productsTo: string | null;
  /** Sus subcategorías: "main" = pasan a ser principales, o el id de otra principal. */
  subcategoriesTo: "main" | string;
};

/**
 * Elimina una categoría. Si tiene productos o subcategorías, primero los
 * mueve según `plan` (si no hay plan y tiene algo, no borra nada y avisa
 * cuántos tiene).
 */
export async function deleteCategory(id: string, plan?: DeletePlan): Promise<ActionResult> {
  await requireAdmin();
  if (!UUID_PATTERN.test(id)) return { ok: false, error: "Categoría inválida." };

  const supabase = await createClient();

  const { data: category, error: readError } = await supabase
    .from("categories")
    .select("image_path, products(count)")
    .eq("id", id)
    .maybeSingle();
  if (readError) return { ok: false, error: GENERIC_ERROR };
  if (!category) return { ok: false, error: "Esta categoría ya no existe. Recargá la página." };

  const productCount = category.products[0]?.count ?? 0;
  const { data: subs, error: subsError } = await supabase.from("categories").select("id").eq("parent_id", id);
  if (subsError) return { ok: false, error: GENERIC_ERROR };

  if ((productCount > 0 || subs.length > 0) && !plan) {
    return {
      ok: false,
      error: "Tiene productos o subcategorías: elegí a dónde moverlos antes de eliminarla.",
      productCount,
    };
  }

  // --- Mover productos ---------------------------------------------------
  if (productCount > 0 && plan) {
    const target = plan.productsTo;
    if (target !== null && (!UUID_PATTERN.test(target) || target === id || subs.some((s) => s.id === target))) {
      return { ok: false, error: "Elegí otra categoría para los productos." };
    }
    const { error } = await supabase.from("products").update({ category_id: target }).eq("category_id", id);
    if (error) return { ok: false, error: "No se pudieron mover los productos. Intentá de nuevo." };
  }

  // --- Mover subcategorías --------------------------------------------------
  if (subs.length > 0 && plan) {
    const target = plan.subcategoriesTo === "main" ? null : plan.subcategoriesTo;
    if (target !== null && (!UUID_PATTERN.test(target) || target === id)) {
      return { ok: false, error: "Elegí otra categoría principal para las subcategorías." };
    }
    const start = await nextSortOrder(supabase, target);
    for (const [i, s] of subs.entries()) {
      const { error } = await supabase
        .from("categories")
        .update({ parent_id: target, sort_order: start + i })
        .eq("id", s.id);
      if (error) {
        return { ok: false, error: levelError(error.message) ?? "No se pudieron mover las subcategorías. Intentá de nuevo." };
      }
    }
  }

  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) {
    // 23503 = la base frenó el borrado: entró un producto o una subcategoría
    // justo en este momento. No se borra nada; se vuelve a intentar.
    if (error.code === "23503") {
      invalidateStore();
      refresh();
      return { ok: false, error: "Justo se agregó algo a esta categoría. Volvé a intentar.", productCount: 1 };
    }
    return { ok: false, error: "No se pudo eliminar. Intentá de nuevo en unos segundos." };
  }

  if (category.image_path) await removeImageFile(category.image_path);

  invalidateStore();
  refresh();
  return { ok: true };
}

// ---------------------------------------------------------------------
// Reordenar
// ---------------------------------------------------------------------

/**
 * Recibe los ids de UN grupo en el orden nuevo (el primero va arriba):
 * todas las principales, o las subcategorías de una principal.
 */
export async function reorderCategories(ids: string[]): Promise<ActionResult> {
  await requireAdmin();
  if (
    !Array.isArray(ids) ||
    ids.length === 0 ||
    ids.length > 1000 ||
    !ids.every((id) => typeof id === "string" && UUID_PATTERN.test(id))
  ) {
    return { ok: false, error: "Orden inválido. Recargá la página." };
  }

  const supabase = await createClient();
  // Función de la base: guarda todo el orden de una vez (o nada).
  const { error } = await supabase.rpc("reorder_categories", { p_ids: ids });
  if (error) return { ok: false, error: "No se pudo guardar el orden. Intentá de nuevo." };

  invalidateStore();
  refresh();
  return { ok: true };
}

// ---------------------------------------------------------------------

/**
 * Borra un archivo de Storage. Si falla no cortamos nada (los datos ya
 * se guardaron bien): a lo sumo queda un archivo sin usar.
 */
async function removeImageFile(path: string) {
  if (!path.startsWith("categories/")) return; // nunca tocar fotos de productos
  const supabase = await createClient();
  await supabase.storage.from(IMAGES_BUCKET).remove([path]);
}
