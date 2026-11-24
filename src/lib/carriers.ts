import type { Database } from "@/lib/database.types";

/**
 * Empresas de envío y su link de seguimiento.
 *
 * Correo Argentino y OCA no tienen un link que lleve el código (solo un
 * formulario de búsqueda): se enlaza a su página de seguimiento y el código
 * se muestra aparte, con "Copiar". Andreani sí acepta el código en la URL
 * (/envio/{código}); verificado solo con un código de ejemplo: si con el
 * primer envío real no anda, cambiar `link` por su página general.
 * "Otra": el link que hayan cargado (opcional).
 */

export type Carrier = Database["public"]["Enums"]["shipping_carrier"];

export const CARRIERS: { value: Carrier; label: string }[] = [
  { value: "correo_argentino", label: "Correo Argentino" },
  { value: "andreani", label: "Andreani" },
  { value: "oca", label: "OCA" },
  { value: "otra", label: "Otra" },
];

const PAGES: Record<Exclude<Carrier, "otra">, { page: string; link?: (code: string) => string }> = {
  correo_argentino: { page: "https://www.correoargentino.com.ar/formularios/e-commerce" },
  andreani: {
    page: "https://www.andreani.com/",
    link: (code) => `https://www.andreani.com/envio/${encodeURIComponent(code)}`,
  },
  oca: { page: "https://www.oca.com.ar/Busquedas/Seguimientos" },
};

export type Tracking = {
  /** "Correo Argentino", "Andreani"… o el nombre que cargaron en "Otra". */
  carrierLabel: string;
  code: string;
  /** Link para seguir el envío (null si "Otra" no tiene). */
  url: string | null;
  /** true si el link ya lleva el código; false = hay que pegarlo en la página. */
  urlHasCode: boolean;
};

export function trackingFor(order: {
  carrier: Carrier | null;
  carrier_name: string | null;
  tracking_code: string | null;
  tracking_url: string | null;
}): Tracking | null {
  if (!order.carrier || !order.tracking_code) return null;
  const code = order.tracking_code;
  if (order.carrier === "otra") {
    return { carrierLabel: order.carrier_name || "Otra empresa", code, url: order.tracking_url, urlHasCode: true };
  }
  const info = PAGES[order.carrier];
  const label = CARRIERS.find((c) => c.value === order.carrier)!.label;
  return info.link
    ? { carrierLabel: label, code, url: info.link(code), urlHasCode: true }
    : { carrierLabel: label, code, url: info.page, urlHasCode: false };
}
