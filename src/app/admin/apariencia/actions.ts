"use server";

import { refresh, updateTag } from "next/cache";
import { getPanelAccess, requireAdmin } from "@/lib/auth";
import { dayAfterStartToIso, dayStartToIso } from "@/lib/dates";
import { STORE_ANNOUNCEMENTS_TAG, STORE_BANNERS_TAG } from "@/lib/store-cache";
import { IMAGES_BUCKET } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";
import { validateAnnouncements, validateBanner } from "./schema";
import type { ActionResult, BannerField, BannerFormValues } from "./types";

/**
 * Server Actions de Banner.
 *
 * Reglas para TODAS:
 *   1. Arrancan con checkAppearanceAccess(): admin + permiso de "Apariencia de la tienda"
 *      (hoy solo el desarrollador; ver can_manage_appearance() en la base).
 *   2. No confían en el navegador: vuelven a validar todo acá.
 *   3. updateTag(STORE_BANNERS_TAG): la tienda muestra el cambio en el
 *      próximo pedido. refresh(): el panel vuelve a pedir sus datos.
 * Por debajo, el RLS solo deja escribir a los admins.
 *
 * Imágenes: bucket product-images, carpeta banners/. Nombre al azar (nunca
 * pisa otro archivo). Si algo falla, se borra lo recién subido; si se
 * cambia o se quita una imagen, se borra la vieja.
 */

const GENERIC_ERROR = "No se pudo guardar. Intentá de nuevo en unos segundos.";
const IMAGE_MAX_BYTES = 3 * 1024 * 1024; // ya llegan comprimidas (~200–600 KB)
const IMAGE_TYPES: Record<string, string> = {
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "image/png": "png",
};
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Las 3 imágenes posibles: campo del formulario → columna de la base. */
const SLOTS = [
  { field: "productImage", column: "product_image_path" },
  { field: "image", column: "image_path" },
  { field: "imageMobile", column: "image_mobile_path" },
] as const;
type Slot = (typeof SLOTS)[number];
type Paths = Record<Slot["column"], string | null>;

/**
 * Admin + permiso de la sección Banner. Devuelve el error para responder,
 * o null si puede seguir. (En una Server Action no se usa notFound(): se
 * devuelve un mensaje claro.)
 */
async function checkAppearanceAccess(): Promise<ActionResult | null> {
  await requireAdmin();
  const access = await getPanelAccess();
  return access.appearance ? null : { ok: false, error: "Tu cuenta no tiene acceso a Apariencia de la tienda." };
}

// ---------------------------------------------------------------------
// Crear o editar
// ---------------------------------------------------------------------

/**
 * FormData: id?, kind, title, body, buttonLabel, buttonUrl, background,
 *           startsOn, endsOn, isActive ("true"/"false"),
 *           productImage? / image? / imageMobile? (archivos ya comprimidos),
 *           removeProductImage? / removeImage? / removeImageMobile? ("true")
 */
export async function saveBanner(formData: FormData): Promise<ActionResult> {
  const denied = await checkAppearanceAccess();
  if (denied) return denied;

  // --- 1. Leer y validar ---------------------------------------------
  const text = (key: string) => String(formData.get(key) ?? "");
  const id = text("id").trim() || null;
  if (id && !UUID_PATTERN.test(id)) return { ok: false, error: "Banner inválido." };

  const values: BannerFormValues = {
    kind: text("kind") as BannerFormValues["kind"],
    title: text("title"),
    body: text("body"),
    buttonLabel: text("buttonLabel"),
    buttonUrl: text("buttonUrl"),
    background: text("background") as BannerFormValues["background"],
    startsOn: text("startsOn"),
    endsOn: text("endsOn"),
    isActive: text("isActive") === "true",
  };
  const result = validateBanner(values);
  const fieldErrors: Partial<Record<BannerField, string>> = result.ok ? {} : { ...result.fieldErrors };

  const files = new Map<Slot["field"], File>();
  for (const slot of SLOTS) {
    const entry = formData.get(slot.field);
    if (!(entry instanceof File) || entry.size === 0) continue;
    if (!(entry.type in IMAGE_TYPES)) fieldErrors[slot.field] = "La imagen tiene que ser JPG, PNG o WebP.";
    else if (entry.size > IMAGE_MAX_BYTES) fieldErrors[slot.field] = "La imagen es demasiado pesada (máx. 3 MB).";
    else files.set(slot.field, entry);
  }

  if (!result.ok || Object.keys(fieldErrors).length > 0) {
    return { ok: false, error: "Revisá los datos marcados.", fieldErrors };
  }
  const data = result.data;

  const supabase = await createClient();

  // --- 2. Si es edición, las imágenes que tiene ahora -----------------
  let previous: Paths = { product_image_path: null, image_path: null, image_mobile_path: null };
  if (id) {
    const { data: current, error } = await supabase
      .from("banners")
      .select("product_image_path, image_path, image_mobile_path")
      .eq("id", id)
      .maybeSingle();
    if (error) return { ok: false, error: GENERIC_ERROR };
    if (!current) return { ok: false, error: "Este banner ya no existe. Volvé a la lista." };
    previous = current;
  }

  // --- 3. Imágenes finales --------------------------------------------
  // Solo se suben las que usa el tipo elegido (la plantilla usa la foto de
  // producto; la imagen completa, las otras dos).
  const used: Record<Slot["field"], boolean> = {
    productImage: data.kind === "template",
    image: data.kind === "image",
    imageMobile: data.kind === "image",
  };

  const uploaded: string[] = [];
  const next: Paths = { product_image_path: null, image_path: null, image_mobile_path: null };
  for (const slot of SLOTS) {
    if (!used[slot.field]) continue; // el otro tipo: queda vacía
    const file = files.get(slot.field);
    if (file) {
      const path = `banners/${crypto.randomUUID()}.${IMAGE_TYPES[file.type]}`;
      const { error } = await supabase.storage
        .from(IMAGES_BUCKET)
        .upload(path, file, { contentType: file.type, upsert: false });
      if (error) {
        await removeImageFiles(uploaded);
        return {
          ok: false,
          error: "No se pudo subir la imagen.",
          fieldErrors: { [slot.field]: "No se pudo subir la imagen. Probá de nuevo." },
        };
      }
      uploaded.push(path);
      next[slot.column] = path;
    } else {
      const removeKey = `remove${slot.field[0].toUpperCase()}${slot.field.slice(1)}`;
      next[slot.column] = formData.get(removeKey) === "true" ? null : previous[slot.column];
    }
  }

  if (data.kind === "image" && !next.image_path) {
    await removeImageFiles(uploaded);
    return {
      ok: false,
      error: "Revisá los datos marcados.",
      fieldErrors: { image: "Subí la imagen del banner (la versión para PC)." },
    };
  }

  // --- 4. Guardar ----------------------------------------------------
  const row = {
    kind: data.kind,
    title: data.title,
    body: data.body,
    button_label: data.buttonLabel,
    button_url: data.buttonUrl,
    background: data.background,
    ...next,
    starts_at: dayStartToIso(data.startsOn),
    ends_at: dayAfterStartToIso(data.endsOn),
    is_active: data.isActive,
  };

  let savedId = id;
  if (id) {
    const { data: saved, error } = await supabase.from("banners").update(row).eq("id", id).select("id");
    if (error || saved.length === 0) {
      await removeImageFiles(uploaded);
      return { ok: false, error: GENERIC_ERROR };
    }
  } else {
    const { data: saved, error } = await supabase.from("banners").insert(row).select("id").single();
    if (error || !saved) {
      await removeImageFiles(uploaded);
      return { ok: false, error: GENERIC_ERROR };
    }
    savedId = saved.id;
  }

  // --- 5. Borrar las imágenes que ya no se usan -----------------------
  const stillUsed = new Set(Object.values(next));
  await removeImageFiles(Object.values(previous).filter((p): p is string => !!p && !stillUsed.has(p)));

  updateTag(STORE_BANNERS_TAG);
  refresh();
  return { ok: true, id: savedId! };
}

// ---------------------------------------------------------------------
// Pausar / reactivar
// ---------------------------------------------------------------------

export async function setBannerActive(id: string, isActive: boolean): Promise<ActionResult> {
  const denied = await checkAppearanceAccess();
  if (denied) return denied;
  if (!UUID_PATTERN.test(id) || typeof isActive !== "boolean") return { ok: false, error: "Banner inválido." };

  const supabase = await createClient();
  const { data, error } = await supabase.from("banners").update({ is_active: isActive }).eq("id", id).select("id");
  if (error) return { ok: false, error: GENERIC_ERROR };
  if (data.length === 0) return { ok: false, error: "Este banner ya no existe. Recargá la página." };

  updateTag(STORE_BANNERS_TAG);
  refresh();
  return { ok: true, id };
}

// ---------------------------------------------------------------------
// Eliminar (con sus imágenes)
// ---------------------------------------------------------------------

export async function deleteBanner(id: string): Promise<ActionResult> {
  const denied = await checkAppearanceAccess();
  if (denied) return denied;
  if (!UUID_PATTERN.test(id)) return { ok: false, error: "Banner inválido." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("banners")
    .delete()
    .eq("id", id)
    .select("product_image_path, image_path, image_mobile_path");
  if (error) return { ok: false, error: "No se pudo eliminar. Intentá de nuevo en unos segundos." };
  if (data.length === 0) return { ok: false, error: "Este banner ya no existe. Recargá la página." };

  const row = data[0];
  await removeImageFiles(
    [row.product_image_path, row.image_path, row.image_mobile_path].filter((p): p is string => !!p),
  );

  updateTag(STORE_BANNERS_TAG);
  refresh();
  return { ok: true, id };
}

// ---------------------------------------------------------------------

/**
 * Borra archivos de Storage. Si falla no cortamos nada (los datos ya se
 * guardaron bien): a lo sumo queda un archivo sin usar.
 */
async function removeImageFiles(paths: string[]) {
  const safe = paths.filter((p) => p.startsWith("banners/")); // nunca tocar otras carpetas
  if (safe.length === 0) return;
  const supabase = await createClient();
  await supabase.storage.from(IMAGES_BUCKET).remove(safe);
}

// ---------------------------------------------------------------------
// Barra de anuncios
// ---------------------------------------------------------------------

/**
 * Guarda TODOS los mensajes de la barra, en este orden (los vacíos se
 * ignoran; sin mensajes, la barra no se muestra). Lo hace la función
 * save_store_announcements de la base: todo o nada.
 */
export async function saveAnnouncements(
  texts: string[],
): Promise<{ ok: true } | { ok: false; error: string; itemErrors?: Record<number, string> }> {
  const denied = await checkAppearanceAccess();
  if (denied && !denied.ok) return { ok: false, error: denied.error };

  if (!Array.isArray(texts) || texts.length > 10 || !texts.every((t) => typeof t === "string")) {
    return { ok: false, error: "Datos inválidos. Recargá la página." };
  }
  const result = validateAnnouncements(texts);
  if (!result.ok) return { ok: false, error: result.error, itemErrors: result.itemErrors };

  const supabase = await createClient();
  const { error } = await supabase.rpc("save_store_announcements", { p_texts: result.data });
  if (error) return { ok: false, error: GENERIC_ERROR };

  updateTag(STORE_ANNOUNCEMENTS_TAG);
  refresh();
  return { ok: true };
}
