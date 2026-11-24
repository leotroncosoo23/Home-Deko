import type { BannerField, BannerFormValues } from "./types";

/**
 * Validación del banner. La usan el formulario (para avisar al toque) y la
 * Server Action (que NO confía en el navegador y vuelve a validar todo).
 * Los mismos límites están en la base (migración tienda_inicio).
 */

export const BANNER_LIMITS = {
  title: 80,
  body: 200,
  buttonLabel: 30,
  buttonUrl: 500,
} as const;

/** Lo que se guarda (ya limpio). */
export type BannerData = {
  kind: BannerFormValues["kind"];
  title: string;
  body: string | null;
  buttonLabel: string | null;
  buttonUrl: string | null;
  background: BannerFormValues["background"];
  startsOn: string;
  endsOn: string;
  isActive: boolean;
};

/** Texto interno del link de una imagen completa (no se muestra en la tienda). */
export const IMAGE_LINK_LABEL = "Ver más";

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
/** Link interno ("/productos", sin "//") o externo seguro ("https://…"). */
const URL_PATTERN = /^(\/[^/\s]\S*|\/|https:\/\/\S+)$/;

/**
 * Ordena lo que escribieron en el link del botón:
 *   "instagram.com/homedeko.hogar" → "https://instagram.com/homedeko.hogar"
 *   "http://…"                     → "https://…"
 *   "productos"                    → "/productos"
 */
export function normalizeButtonUrl(raw: string): string {
  const url = raw.trim();
  if (!url) return "";
  if (url.startsWith("/") || url.startsWith("https://")) return url;
  if (url.startsWith("http://")) return `https://${url.slice("http://".length)}`;
  // Parece un dominio (tiene un punto antes de la primera barra): externo.
  const firstPart = url.split("/")[0];
  if (firstPart.includes(".")) return `https://${url}`;
  return `/${url}`;
}

export function validateBanner(
  v: BannerFormValues,
): { ok: true; data: BannerData } | { ok: false; fieldErrors: Partial<Record<BannerField, string>> } {
  const errors: Partial<Record<BannerField, string>> = {};
  const isTemplate = v.kind === "template";

  const title = v.title.trim();
  const body = v.body.trim();
  const buttonLabel = v.buttonLabel.trim();
  const buttonUrl = normalizeButtonUrl(v.buttonUrl);

  if (v.kind !== "template" && v.kind !== "image") errors.kind = "Elegí un tipo de banner.";
  if (v.background !== "red" && v.background !== "white") errors.background = "Elegí un fondo.";

  if (!title) {
    errors.title = isTemplate
      ? "Escribí un título."
      : "Escribí una descripción corta de la imagen (la leen quienes usan lector de pantalla).";
  } else if (title.length > BANNER_LIMITS.title) {
    errors.title = `Máximo ${BANNER_LIMITS.title} caracteres.`;
  }

  if (isTemplate && body.length > BANNER_LIMITS.body) errors.body = `Máximo ${BANNER_LIMITS.body} caracteres.`;

  // Botón: en la plantilla, texto y link van juntos. En la imagen completa
  // solo hay link (toda la imagen se puede tocar).
  if (isTemplate) {
    if (buttonLabel && !buttonUrl) errors.buttonUrl = "Escribí a dónde lleva el botón.";
    if (!buttonLabel && buttonUrl) errors.buttonLabel = "Escribí el texto del botón.";
    if (buttonLabel.length > BANNER_LIMITS.buttonLabel) {
      errors.buttonLabel = `Máximo ${BANNER_LIMITS.buttonLabel} caracteres.`;
    }
  }
  if (buttonUrl && (buttonUrl.length > BANNER_LIMITS.buttonUrl || !URL_PATTERN.test(buttonUrl))) {
    errors.buttonUrl = "Revisá el link: tiene que ser una página de la tienda (ej.: /productos) o empezar con https://";
  }

  if (v.startsOn && !DAY_PATTERN.test(v.startsOn)) errors.startsOn = "Fecha inválida.";
  if (v.endsOn && !DAY_PATTERN.test(v.endsOn)) errors.endsOn = "Fecha inválida.";
  if (!errors.startsOn && !errors.endsOn && v.startsOn && v.endsOn && v.endsOn < v.startsOn) {
    errors.endsOn = "La fecha de fin tiene que ser igual o posterior a la de inicio.";
  }

  if (Object.keys(errors).length > 0) return { ok: false, fieldErrors: errors };

  return {
    ok: true,
    data: {
      kind: v.kind,
      title,
      body: isTemplate && body ? body : null,
      // La base pide texto y link juntos. En la imagen completa el texto no
      // se muestra (se toca toda la imagen): se guarda uno fijo.
      buttonLabel: !buttonUrl ? null : isTemplate ? buttonLabel : IMAGE_LINK_LABEL,
      buttonUrl: buttonUrl || null,
      background: v.background,
      startsOn: v.startsOn,
      endsOn: v.endsOn,
      isActive: v.isActive,
    },
  };
}

// ---------------------------------------------------------------------------
// Barra de anuncios
// ---------------------------------------------------------------------------

export const ANNOUNCEMENTS_MAX = 4;
export const ANNOUNCEMENT_MAX_LENGTH = 120;

/** Una sola línea: sin saltos ni espacios de más. */
export function cleanAnnouncement(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * Valida la lista de mensajes (los vacíos se ignoran). Devuelve la lista
 * limpia o el error de cada mensaje (por posición).
 */
export function validateAnnouncements(
  texts: string[],
): { ok: true; data: string[] } | { ok: false; error: string; itemErrors: Record<number, string> } {
  const itemErrors: Record<number, string> = {};
  texts.forEach((t, i) => {
    if (cleanAnnouncement(t).length > ANNOUNCEMENT_MAX_LENGTH) {
      itemErrors[i] = `Máximo ${ANNOUNCEMENT_MAX_LENGTH} caracteres.`;
    }
  });
  const data = texts.map(cleanAnnouncement).filter(Boolean);
  if (data.length > ANNOUNCEMENTS_MAX) {
    return { ok: false, error: `Como máximo ${ANNOUNCEMENTS_MAX} mensajes.`, itemErrors };
  }
  if (Object.keys(itemErrors).length > 0) return { ok: false, error: "Revisá los mensajes marcados.", itemErrors };
  return { ok: true, data };
}
