import "server-only";
import { requireAppearanceAccess } from "@/lib/auth";
import { toBannerView } from "@/lib/banners";
import { exclusiveEndToArgentinaDay, isoToArgentinaDay } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { IMAGE_LINK_LABEL } from "./schema";
import type { AdminBanner, BannerStatus } from "./types";

/**
 * Banners para el panel, SIN caché (siempre el dato del momento).
 * Arrancan con requireAppearanceAccess() (admin + permiso de la sección Banner;
 * si no lo tiene, notFound()). Llamarlas dentro de <Suspense>.
 */

const COLUMNS =
  "id, kind, title, body, button_label, button_url, background, product_image_path, image_path, image_mobile_path, starts_at, ends_at, is_active, position, updated_at";

type Row = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  button_label: string | null;
  button_url: string | null;
  background: string;
  product_image_path: string | null;
  image_path: string | null;
  image_mobile_path: string | null;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  position: number;
  updated_at: string;
};

/** Mismo criterio que la policy de la base (ver la migración tienda_inicio). */
function statusOf(row: Row, now: number): BannerStatus {
  if (!row.is_active) return "paused";
  if (row.starts_at && new Date(row.starts_at).getTime() > now) return "scheduled";
  if (row.ends_at && new Date(row.ends_at).getTime() <= now) return "ended";
  return "live";
}

function toAdminBanner(row: Row, now: number): AdminBanner {
  const view = toBannerView(row);
  return {
    ...view,
    // En las imágenes completas el texto del botón es interno: no se edita.
    buttonLabel: view.kind === "image" && view.buttonLabel === IMAGE_LINK_LABEL ? null : view.buttonLabel,
    id: row.id,
    productImagePath: row.product_image_path,
    imagePath: row.image_path,
    imageMobilePath: row.image_mobile_path,
    startsOn: isoToArgentinaDay(row.starts_at),
    endsOn: exclusiveEndToArgentinaDay(row.ends_at),
    isActive: row.is_active,
    status: statusOf(row, now),
    position: row.position,
    updatedAt: row.updated_at,
  };
}

/**
 * Todos los banners (como máximo 3), en el orden del carrusel. La tienda
 * muestra, en este mismo orden, los que están "live" (getActiveBanners en
 * src/lib/store-data.ts).
 */
export async function getBannersForAdmin(): Promise<AdminBanner[]> {
  await requireAppearanceAccess();
  const supabase = await createClient();

  const { data, error } = await supabase.from("banners").select(COLUMNS).order("position");
  if (error) throw new Error("No se pudieron cargar los banners.");

  const now = Date.now();
  return data.map((row) => toAdminBanner(row, now));
}

/** Cuántos banners hay (para no ofrecer "Nuevo banner" si ya hay 3). */
export async function countBannersForAdmin(): Promise<number> {
  await requireAppearanceAccess();
  const supabase = await createClient();

  const { count, error } = await supabase.from("banners").select("id", { count: "exact", head: true });
  if (error) throw new Error("No se pudieron cargar los banners.");
  return count ?? 0;
}

/** Un banner para editar (o null si no existe). */
export async function getBannerForAdmin(id: string): Promise<AdminBanner | null> {
  await requireAppearanceAccess();
  const supabase = await createClient();

  const { data, error } = await supabase.from("banners").select(COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error("No se pudo cargar el banner.");
  return data ? toAdminBanner(data, Date.now()) : null;
}

/** Mensajes de la barra de anuncios, en orden (para editarlos). */
export async function getAnnouncementsForAdmin(): Promise<string[]> {
  await requireAppearanceAccess();
  const supabase = await createClient();

  const { data, error } = await supabase.from("store_announcements").select("text").order("position");
  if (error) throw new Error("No se pudo cargar la barra de anuncios.");
  return data.map((a) => a.text);
}
