/**
 * De dónde viene una visita a la tienda.
 *
 * Se decide con dos datos que manda el navegador (nada personal):
 *   1. utm_source del link, si lo tiene (ej.: el link de la bio de Instagram
 *      con ?utm_source=instagram). Es lo más confiable: se usa primero.
 *   2. El DOMINIO de la página anterior (document.referrer), nunca la URL completa.
 *      Las apps de Android a veces mandan "android-app://com.instagram.android":
 *      también se reconocen.
 *
 * WhatsApp casi nunca manda referrer: esas visitas suelen caer en "directo"
 * salvo que el link tenga utm_source=whatsapp.
 *
 * Los mismos valores valida la base (track_visit en 20261202000001_inicio_panel.sql).
 */

export const VISIT_SOURCES = ["instagram", "tiktok", "facebook", "google", "whatsapp", "otros", "directo"] as const;
export type VisitSource = (typeof VISIT_SOURCES)[number];

export const VISIT_SOURCE_LABELS: Record<VisitSource, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  facebook: "Facebook",
  google: "Google",
  whatsapp: "WhatsApp",
  otros: "Otros sitios",
  directo: "Directo",
};

type Rule = { source: Exclude<VisitSource, "otros" | "directo">; utm: RegExp; host: RegExp };

const RULES: Rule[] = [
  {
    source: "instagram",
    utm: /^(ig|instagram.*)$/,
    host: /(^|\.)instagram\.com$|^com\.instagram\.android$/,
  },
  {
    source: "tiktok",
    utm: /^tiktok.*$/,
    host: /(^|\.)tiktok\.com$|^com\.zhiliaoapp\.musically$|^com\.ss\.android\.ugc\.trill$/,
  },
  {
    source: "facebook",
    utm: /^(fb|facebook.*|messenger)$/,
    host: /(^|\.)(facebook\.com|fb\.com|fb\.me|messenger\.com)$|^com\.facebook\.(katana|orca|lite)$/,
  },
  {
    source: "google",
    utm: /^google.*$/,
    // google.com, google.com.ar, www.google.es… y la app de Google en Android
    host: /(^|\.)google\.[a-z]{2,3}(\.[a-z]{2})?$|^com\.google\.android\.googlequicksearchbox$/,
  },
  {
    source: "whatsapp",
    utm: /^(wa|whatsapp.*)$/,
    host: /(^|\.)(whatsapp\.com|wa\.me)$|^com\.whatsapp(\.w4b)?$/,
  },
];

export function classifyVisitSource({
  utmSource,
  referrerHost,
  siteHost,
}: {
  utmSource?: string | null;
  referrerHost?: string | null;
  /** El dominio de la tienda: venir desde la misma tienda = "directo". */
  siteHost?: string | null;
}): VisitSource {
  const utm = (utmSource ?? "").trim().toLowerCase();
  if (utm) {
    const rule = RULES.find((r) => r.utm.test(utm));
    return rule ? rule.source : "otros";
  }

  const host = normalizeHost(referrerHost);
  if (!host) return "directo";
  if (siteHost && host === normalizeHost(siteHost)) return "directo";
  const rule = RULES.find((r) => r.host.test(host));
  return rule ? rule.source : "otros";
}

function normalizeHost(host: string | null | undefined): string {
  return (host ?? "")
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, "")
    .replace(/^www\./, "");
}
