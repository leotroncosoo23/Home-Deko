"use server";

import { refresh } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SLUG_MAX_LENGTH, SLUG_PATTERN } from "@/lib/slug";
import { IMAGES_BUCKET } from "@/lib/storage";
import type { ActionResult, CategoryField } from "./types";

/**
 * Server Actions de Categorías.
 *
 * Reglas para TODAS:
 *   1. Arrancan con requireAdmin() (rol leído de la base en el momento).
 *   2. No confían en el navegador: vuelven a validar todo acá.
 *   3. Terminan con refresh(), que vuelve a pedir la página para que el
 *      listado muestre los datos nuevos.
 * Por debajo, el RLS de la base es la última barrera.
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

// ---------------------------------------------------------------------
// Crear o editar
// ---------------------------------------------------------------------

/**
 * Crea (sin "id") o edita (con "id") una categoría.
 *
 * FormData: id?, name, slug, isVisible ("true"/"false"),
 *           image? (archivo ya comprimido), removeImage? ("true")
 */
export async function saveCategory(formData: FormData): Promise<ActionResult> {
  await requireAdmin();

  // --- 1. Leer y validar ---------------------------------------------
  const id = String(formData.get("id") ?? "").trim() || null;
  const name = String(formData.get("name") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim().toLowerCase();
  const isVisible = formData.get("isVisible") === "true";
  const removeImage = formData.get("removeImage") === "true";
  const imageEntry = formData.get("image");
  const image = imageEntry instanceof File && imageEntry.size > 0 ? imageEntry : null;

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
  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, error: "Revisá los datos marcados.", fieldErrors };
  }

  const supabase = await createClient();

  // --- 2. Si es edición, traer la categoría actual (para la imagen vieja)
  let previousImagePath: string | null = null;
  if (id) {
    const { data: current, error } = await supabase
      .from("categories")
      .select("image_path")
      .eq("id", id)
      .maybeSingle();
    if (error) return { ok: false, error: GENERIC_ERROR };
    if (!current) return { ok: false, error: "Esta categoría ya no existe. Recargá la página." };
    previousImagePath = current.image_path;
  }

  // --- 3. Subir la imagen nueva (si hay) ------------------------------
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

  const imagePath = uploadedPath ?? (removeImage ? null : previousImagePath);

  // --- 4. Guardar en la base ------------------------------------------
  let dbError: { code: string } | null;
  if (id) {
    ({ error: dbError } = await supabase
      .from("categories")
      .update({ name, slug, is_visible: isVisible, image_path: imagePath })
      .eq("id", id));
  } else {
    // Las nuevas van al final de la lista.
    const { data: last } = await supabase
      .from("categories")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    ({ error: dbError } = await supabase.from("categories").insert({
      name,
      slug,
      is_visible: isVisible,
      image_path: imagePath,
      sort_order: (last?.sort_order ?? 0) + 1,
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
    return { ok: false, error: GENERIC_ERROR };
  }

  // --- 5. Si la imagen cambió o se quitó, borrar la vieja -------------
  if (previousImagePath && previousImagePath !== imagePath) {
    await removeImageFile(previousImagePath);
  }

  refresh();
  return { ok: true };
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

  refresh();
  return { ok: true };
}

// ---------------------------------------------------------------------
// Eliminar (solo si no tiene productos)
// ---------------------------------------------------------------------

export async function deleteCategory(id: string): Promise<ActionResult> {
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
  if (productCount > 0) return hasProductsError(productCount);

  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) {
    // 23503 = la base frenó el borrado porque hay productos (on delete
    // restrict). Pasa si alguien cargó un producto justo en este momento.
    if (error.code === "23503") return hasProductsError(1);
    return { ok: false, error: "No se pudo eliminar. Intentá de nuevo en unos segundos." };
  }

  if (category.image_path) await removeImageFile(category.image_path);

  refresh();
  return { ok: true };
}

function hasProductsError(productCount: number): ActionResult {
  return {
    ok: false,
    error:
      productCount === 1
        ? "No se puede eliminar porque tiene un producto. Podés ocultarla."
        : `No se puede eliminar porque tiene ${productCount} productos. Podés ocultarla.`,
    productCount,
  };
}

// ---------------------------------------------------------------------
// Reordenar
// ---------------------------------------------------------------------

/** Recibe TODOS los ids en el orden nuevo (el primero va arriba). */
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
