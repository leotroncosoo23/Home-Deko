"use server";

import { refresh } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { IMAGES_BUCKET, publicImageUrl } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/database.types";
import { issuesToErrors, productInputSchema, type ProductInput } from "./schema";
import type { ListActionResult, SaveProductResult, UploadImageResult } from "./types";

/**
 * Server Actions de Productos.
 * Todas: requireAdmin() → validar con zod → base (RLS) → refresh().
 */

const GENERIC_ERROR = "No se pudo guardar. Intentá de nuevo en unos segundos.";

/** Guarda un producto completo (crear o editar) con save_product(). */
export async function saveProduct(rawInput: unknown): Promise<SaveProductResult> {
  await requireAdmin();

  // 1. Validar (el navegador ya validó, pero nunca confiamos en él)
  const parsed = productInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, error: "Revisá los campos marcados.", fieldErrors: issuesToErrors(parsed.error.issues) };
  }
  const input = parsed.data;

  // 2. Guardar todo de una vez en la base (una sola transacción)
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_product", { p: toPayload(input) });

  if (error) return translateError(error);

  const result = data as { id: string; updated_at: string; removed_image_paths: string[] };

  // 3. Borrar de Storage las fotos que se quitaron (solo de ESTE producto)
  const removed = (result.removed_image_paths ?? []).filter((path) => path.startsWith(`${input.id}/`));
  if (removed.length > 0) {
    await supabase.storage.from(IMAGES_BUCKET).remove(removed);
  }

  refresh();
  return { ok: true, id: result.id, updatedAt: result.updated_at };
}

// ---------------------------------------------------------------------
// Imágenes (parte 5C)
// ---------------------------------------------------------------------

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const IMAGE_MAX_BYTES = 2 * 1024 * 1024; // llegan comprimidas (~100–300 KB)
const IMAGE_TYPES: Record<string, string> = { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png" };

/**
 * Sube UNA foto a la carpeta del producto: product-images/<id>/<azar>.webp
 * La foto queda en Storage, pero recién se "engancha" al producto cuando
 * se guarda el formulario (save_product).
 *
 * FormData: productId, file (ya comprimida en el navegador)
 */
export async function uploadProductImage(formData: FormData): Promise<UploadImageResult> {
  await requireAdmin();

  const productId = String(formData.get("productId") ?? "");
  const file = formData.get("file");
  if (!UUID_PATTERN.test(productId)) return { ok: false, error: "Producto inválido." };
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "No llegó la imagen." };
  if (!(file.type in IMAGE_TYPES)) return { ok: false, error: "Tiene que ser JPG, PNG o WebP." };
  if (file.size > IMAGE_MAX_BYTES) return { ok: false, error: "La imagen es demasiado pesada (máx. 2 MB)." };

  // Nombre al azar: nunca pisa otra foto y evita que el navegador muestre una vieja.
  const storagePath = `${productId}/${crypto.randomUUID()}.${IMAGE_TYPES[file.type]}`;
  const supabase = await createClient();
  const { error } = await supabase.storage
    .from(IMAGES_BUCKET)
    .upload(storagePath, file, { contentType: file.type, upsert: false });
  if (error) return { ok: false, error: "No se pudo subir. Probá de nuevo." };

  return { ok: true, storagePath, url: publicImageUrl(storagePath) };
}

/**
 * Borra fotos que se subieron pero se quitaron ANTES de guardar (no están
 * en la base). Las que ya estaban guardadas las borra saveProduct.
 * Por seguridad: solo de la carpeta de ese producto y solo si la base no
 * las usa.
 */
export async function discardProductImages(productId: string, paths: string[]): Promise<void> {
  await requireAdmin();
  if (!UUID_PATTERN.test(productId) || !Array.isArray(paths) || paths.length === 0 || paths.length > 50) return;

  const inFolder = paths.filter((p) => typeof p === "string" && p.startsWith(`${productId}/`) && !p.includes(".."));
  if (inFolder.length === 0) return;

  const supabase = await createClient();
  const { data: used } = await supabase.from("product_images").select("storage_path").in("storage_path", inFolder);
  const usedSet = new Set((used ?? []).map((u) => u.storage_path));
  const unused = inFolder.filter((p) => !usedSet.has(p));
  if (unused.length > 0) await supabase.storage.from(IMAGES_BUCKET).remove(unused);
}

/** Del formato de la app (camelCase) al JSON que espera save_product. */
function toPayload(p: ProductInput): Json {
  return {
    id: p.id,
    is_new: p.isNew,
    expected_updated_at: p.expectedUpdatedAt,
    name: p.name,
    slug: p.slug,
    description: p.description,
    category_id: p.categoryId,
    base_price: p.basePrice,
    cost_price: p.costPrice,
    status: p.status,
    is_featured: p.isFeatured,
    has_variants: p.hasVariants,
    discount: p.discount
      ? { type: p.discount.type, value: p.discount.value, starts_at: p.discount.startsAt, ends_at: p.discount.endsAt }
      : null,
    options: p.options.map((o) => ({
      id: o.id,
      name: o.name,
      values: o.values.map((v) => ({ key: v.key, id: v.id, value: v.value, color_hex: v.colorHex })),
    })),
    variants: p.variants.map((v) => ({
      id: v.id,
      value_keys: v.valueKeys,
      sku: v.sku,
      price: v.price,
      cost_price: v.costPrice,
      min_stock: v.minStock,
      initial_stock: v.initialStock,
    })),
    images: p.images.map((img) => ({
      storage_path: img.storagePath,
      is_primary: img.isPrimary,
      color_value_key: img.colorValueKey,
      alt_text: img.altText,
    })),
  };
}

/** Errores de la base → mensajes claros en español. */
function translateError(error: { code: string; message: string }): SaveProductResult {
  switch (error.code) {
    case "HD409": // otra persona lo editó
      return { ok: false, error: error.message, conflict: true };
    case "HD404":
    case "HD422": // reglas del negocio: el mensaje ya viene en español
      return { ok: false, error: error.message };
    case "23505": // valor repetido
      if (error.message.includes("products_slug_key")) {
        return {
          ok: false,
          error: "Revisá los campos marcados.",
          fieldErrors: { slug: "Ya existe un producto con ese slug." },
        };
      }
      if (error.message.includes("product_variants_sku_key")) {
        return { ok: false, error: "Uno de los SKU ya lo usa otro producto. Cambialo y volvé a guardar." };
      }
      if (error.message.includes("product_options_product_id_name_key")) {
        return { ok: false, error: "Hay dos opciones con el mismo nombre." };
      }
      if (error.message.includes("product_option_values_option_id_value_key")) {
        return { ok: false, error: "Hay valores repetidos en una opción." };
      }
      return { ok: false, error: GENERIC_ERROR };
    case "23503": // la categoría elegida ya no existe
      return {
        ok: false,
        error: "Revisá los campos marcados.",
        fieldErrors: { categoryId: "Esa categoría ya no existe. Elegí otra." },
      };
    case "42501":
      return { ok: false, error: "Tu cuenta no tiene permiso para guardar productos." };
    default:
      return { ok: false, error: GENERIC_ERROR };
  }
}

// =====================================================================
// Listado (paso 6): acciones de a uno o en masa
// =====================================================================

const MAX_BULK = 200;

/** Valida una lista de ids que viene del navegador. */
function validIds(ids: unknown): string[] | null {
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > MAX_BULK) return null;
  if (!ids.every((id) => typeof id === "string" && UUID_PATTERN.test(id))) return null;
  return [...new Set(ids as string[])];
}

const plural = (n: number, one: string, many: string) => (n === 1 ? `1 ${one}` : `${n} ${many}`);

/**
 * Cambia el estado de uno o varios productos:
 *   "active"   → Publicar (los que no tienen precio se saltean y se avisa)
 *   "draft"    → Pasar a borrador / Desarchivar (vuelve como Borrador)
 *   "archived" → Archivar
 */
export async function setProductsStatus(
  rawIds: string[],
  status: "active" | "draft" | "archived",
): Promise<ListActionResult> {
  await requireAdmin();
  const ids = validIds(rawIds);
  if (!ids || !["active", "draft", "archived"].includes(status)) {
    return { ok: false, error: "Selección inválida. Recargá la página." };
  }
  const supabase = await createClient();

  // Para publicar, todo lo que se vende tiene que tener precio (igual que
  // en el formulario). min_price = el precio más bajo de sus variantes.
  let toUpdate = ids;
  let skipped: string[] = [];
  if (status === "active") {
    const { data, error } = await supabase.from("admin_products").select("id, name, min_price").in("id", ids);
    if (error) return { ok: false, error: GENERIC_LIST_ERROR };
    toUpdate = data.filter((p) => (p.min_price ?? 0) > 0).map((p) => p.id ?? "");
    skipped = data.filter((p) => (p.min_price ?? 0) <= 0).map((p) => p.name ?? "");
  }

  let updated = 0;
  if (toUpdate.length > 0) {
    const { data, error } = await supabase.from("products").update({ status }).in("id", toUpdate).select("id");
    if (error) return { ok: false, error: GENERIC_LIST_ERROR };
    updated = data.length;
  }

  refresh();
  const done = { active: "publicado", draft: "pasado a borrador", archived: "archivado" }[status];
  const donePlural = { active: "publicados", draft: "pasados a borrador", archived: "archivados" }[status];
  let message = updated > 0 ? `${plural(updated, `producto ${done}`, `productos ${donePlural}`)}.` : "";
  if (skipped.length > 0) {
    message += ` ${skipped.length === 1 ? `«${skipped[0]}» no se publicó` : `${skipped.length} no se publicaron`} porque no tiene${skipped.length === 1 ? "" : "n"} precio.`;
  }
  if (updated === 0 && skipped.length > 0) return { ok: false, error: message.trim() };
  return { ok: true, message: message.trim() || "Listo." };
}

/** Cambia la categoría de uno o varios productos (null = sin categoría). */
export async function setProductsCategory(rawIds: string[], categoryId: string | null): Promise<ListActionResult> {
  await requireAdmin();
  const ids = validIds(rawIds);
  if (!ids || (categoryId !== null && !UUID_PATTERN.test(categoryId))) {
    return { ok: false, error: "Selección inválida. Recargá la página." };
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .update({ category_id: categoryId })
    .in("id", ids)
    .select("id");
  if (error) {
    return {
      ok: false,
      error: error.code === "23503" ? "Esa categoría ya no existe. Recargá la página." : GENERIC_LIST_ERROR,
    };
  }
  refresh();
  return { ok: true, message: `Categoría cambiada en ${plural(data.length, "producto", "productos")}.` };
}

/**
 * Elimina definitivamente un producto (solo si nunca tuvo movimientos de
 * stock además del "inicial"; lo controla la base) y borra TODA su carpeta
 * de fotos en Storage (también fotos sueltas que hubieran quedado).
 */
export async function deleteProduct(id: string): Promise<ListActionResult> {
  await requireAdmin();
  if (typeof id !== "string" || !UUID_PATTERN.test(id)) return { ok: false, error: "Producto inválido." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("delete_product", { p_id: id });
  if (error) {
    if (error.code === "HD422") return { ok: false, error: error.message, canArchive: true };
    if (error.code === "HD404") return { ok: false, error: error.message };
    return { ok: false, error: "No se pudo eliminar. Intentá de nuevo en unos segundos." };
  }

  // Fotos: las que tenía guardadas + cualquier archivo que quede en su carpeta
  const saved = ((data as { image_paths?: string[] }).image_paths ?? []).filter((p) => p.startsWith(`${id}/`));
  const { data: listed } = await supabase.storage.from(IMAGES_BUCKET).list(id, { limit: 1000 });
  const all = [...new Set([...saved, ...(listed ?? []).map((f) => `${id}/${f.name}`)])];
  if (all.length > 0) await supabase.storage.from(IMAGES_BUCKET).remove(all);

  refresh();
  return { ok: true, message: "Producto eliminado." };
}

/**
 * Busca un producto por código de barras o SKU EXACTO (lo que escribe el
 * lector USB al escanear; más adelante, también la cámara de la App Home Deko).
 * Devuelve el id si hay exactamente un producto con ese código.
 */
export async function findProductByCode(code: string): Promise<{ productId: string } | null> {
  await requireAdmin();
  const clean = typeof code === "string" ? code.trim() : "";
  // Solo caracteres de un código o SKU (además evita romper el filtro)
  if (clean.length < 3 || clean.length > 60 || !/^[A-Za-z0-9._-]+$/.test(clean)) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("product_variants")
    .select("product_id")
    // Los SKU se guardan en mayúsculas (el formulario los convierte)
    .or(`barcode.eq.${clean},sku.eq.${clean.toUpperCase()}`)
    .limit(5);
  if (error || !data) return null;

  const products = [...new Set(data.map((v) => v.product_id))];
  return products.length === 1 ? { productId: products[0] } : null;
}

const GENERIC_LIST_ERROR = "No se pudo completar la acción. Intentá de nuevo en unos segundos.";
