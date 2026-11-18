import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { NOMBRE_COMERCIO, SITIO, type DatosComercio } from "@/content/legales";
import { formatARS, formatCuit } from "@/lib/format";
import { createPublicClient } from "@/lib/supabase/public";

/**
 * CONFIGURACIÓN DE LA TIENDA (tabla store_settings, una sola fila).
 * Se edita en el panel: /admin/configuracion.
 *
 * Cómo se mantiene rápida:
 *   - getStoreSettings() está cacheada ("use cache"): la página "Muy pronto",
 *     el pie y las páginas legales siguen siendo estáticas.
 *   - Al guardar en el panel, la Server Action llama a
 *     updateTag(STORE_SETTINGS_TAG) y el próximo pedido ya ve el dato nuevo.
 *
 * El proxy (src/proxy.ts) NO usa esta función: consulta is_launched directo
 * en cada pedido de un visitante (en el proxy no hay caché de Next).
 */

export const STORE_SETTINGS_TAG = "store-settings";

/** Columnas que se pueden leer desde la tienda (ver el grant en la migración). */
export const STORE_SETTINGS_COLUMNS =
  "id, is_launched, whatsapp, instagram, tiktok, shipping_cost, store_address, store_hours, exchange_days, business_name, cuit, contact_email";

export type StoreSettings = {
  id: string;
  isLaunched: boolean;
  /** Solo dígitos, con código de país (ej.: 5492945123456). "" si no hay. */
  whatsapp: string;
  /** Usuario, sin @. */
  instagram: string;
  tiktok: string;
  shippingCost: number;
  storeAddress: string;
  storeHours: string;
  /** Días para cambios por gusto (sin falla). 0 = no se aceptan. */
  exchangeDays: number;
  /** Nombre o razón social. */
  businessName: string;
  /** 11 dígitos, sin guiones. */
  cuit: string;
  contactEmail: string;
};

type Row = {
  id: string;
  is_launched: boolean;
  whatsapp: string;
  instagram: string;
  tiktok: string;
  shipping_cost: number;
  store_address: string;
  store_hours: string;
  exchange_days: number;
  business_name: string;
  cuit: string;
  contact_email: string;
};

/** Fila de la base → objeto que usa la app (también lo usa el panel). */
export function mapStoreSettings(row: Row): StoreSettings {
  return {
    id: row.id,
    isLaunched: row.is_launched,
    whatsapp: row.whatsapp,
    instagram: row.instagram,
    tiktok: row.tiktok,
    shippingCost: Number(row.shipping_cost),
    storeAddress: row.store_address,
    storeHours: row.store_hours,
    exchangeDays: row.exchange_days,
    businessName: row.business_name,
    cuit: row.cuit,
    contactEmail: row.contact_email,
  };
}

/** La configuración, cacheada hasta que se guarde desde el panel. */
export async function getStoreSettings(): Promise<StoreSettings> {
  "use cache";
  cacheTag(STORE_SETTINGS_TAG);
  cacheLife("max");

  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("store_settings")
    .select(STORE_SETTINGS_COLUMNS)
    .single();

  // Si falla, error (no se cachea): nunca guardar en caché datos inventados.
  if (error || !data) throw new Error("No se pudo leer la configuración de la tienda.");
  return mapStoreSettings(data);
}

// ---------------------------------------------------------------------------
// Para mostrar
// ---------------------------------------------------------------------------

const FALTA = "[COMPLETAR]";

/**
 * Datos del comercio para el pie y las páginas legales. Lo que todavía no
 * se cargó en el panel sale como "[COMPLETAR]" (se ve resaltado).
 */
export function datosComercio(s: StoreSettings): DatosComercio {
  return {
    nombre: NOMBRE_COMERCIO,
    razonSocial: s.businessName || FALTA,
    cuit: s.cuit ? formatCuit(s.cuit) : FALTA,
    direccion: s.storeAddress || FALTA,
    sitio: SITIO,
    email: s.contactEmail || FALTA,
    horarios: s.storeHours || FALTA,
    cambiosDias: s.exchangeDays,
    // "$ 20.000" en vez de "$ 20.000,00" (en un texto se lee mejor sin centavos)
    envioDomicilio: formatARS(s.shippingCost).replace(/,00$/, ""),
  };
}

export type RedSocial = {
  red: "instagram" | "tiktok" | "whatsapp";
  /** Nombre para mostrar y para el lector de pantalla. */
  label: string;
  href: string;
};

/** Mensaje que aparece ya escrito al abrir el WhatsApp de la tienda. */
const WHATSAPP_MENSAJE = "Hola Home Deko, quería hacer una consulta.";

/** Links a las redes cargadas (las vacías no aparecen). */
export function redesSociales(s: StoreSettings): RedSocial[] {
  const redes: RedSocial[] = [];
  if (s.instagram) {
    redes.push({ red: "instagram", label: "Instagram", href: `https://www.instagram.com/${s.instagram}/` });
  }
  if (s.tiktok) {
    redes.push({ red: "tiktok", label: "TikTok", href: `https://www.tiktok.com/@${s.tiktok}` });
  }
  if (s.whatsapp) {
    redes.push({
      red: "whatsapp",
      label: "WhatsApp",
      href: `https://wa.me/${s.whatsapp}?text=${encodeURIComponent(WHATSAPP_MENSAJE)}`,
    });
  }
  return redes;
}
