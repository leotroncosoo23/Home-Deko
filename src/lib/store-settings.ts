import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { NOMBRE_COMERCIO, SITIO, type DatosComercio } from "@/content/legales";
import { formatCuit, formatPrice, formatWhatsApp } from "@/lib/format";
import { paymentCopy } from "@/lib/payments/config";
import { INSTALLMENT_OPTIONS, type InstallmentCount, parsePricingPreview, type PricingSettings } from "@/lib/pricing";
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
  "id, is_launched, whatsapp, instagram, tiktok, shipping_cost, store_address, store_hours, exchange_days, business_name, cuit, contact_email, dispatch_time, show_price_without_taxes, national_tax_percent, list_surcharge_percent, installments_enabled, installments_max";

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
  /** Plazo de despacho de los envíos, texto libre (ej.: "24 a 48 h hábiles"). "" si no se cargó. */
  dispatchTime: string;
  /** Mostrar "Precio sin impuestos nacionales" en la página del producto (apagado por defecto). */
  showPriceWithoutTaxes: boolean;
  /** % de impuestos nacionales para ese cálculo (21 por defecto). */
  nationalTaxPercent: number;
  /** % de recargo para el precio de lista (cuotas). 0 = lista igual a contado. Ver src/lib/pricing.ts. */
  listSurchargePercent: number;
  /** Mostrar "hasta N cuotas sin interés" (apagado por defecto). */
  installmentsEnabled: boolean;
  installmentsMax: InstallmentCount;
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
  dispatch_time: string;
  show_price_without_taxes: boolean;
  national_tax_percent: number;
  list_surcharge_percent: number;
  installments_enabled: boolean;
  installments_max: number;
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
    dispatchTime: row.dispatch_time,
    showPriceWithoutTaxes: row.show_price_without_taxes,
    nationalTaxPercent: Number(row.national_tax_percent),
    listSurchargePercent: Number(row.list_surcharge_percent),
    installmentsEnabled: row.installments_enabled,
    installmentsMax: toInstallmentCount(row.installments_max),
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

export function toInstallmentCount(n: number): InstallmentCount {
  return INSTALLMENT_OPTIONS.includes(n as InstallmentCount) ? (n as InstallmentCount) : 6;
}

/**
 * Lo que necesita getPrices() (src/lib/pricing.ts).
 *
 * Solo en desarrollo: PRICING_PREVIEW="24,6" en .env.local pisa el recargo y las
 * cuotas para ver la tienda sin tocar la configuración real. En producción se
 * ignora siempre. El cobro (create_order) no depende del recargo: es el precio cargado.
 */
export function pricingFrom(s: StoreSettings): PricingSettings {
  const preview = pricingPreview();
  if (preview) return preview;
  return {
    listSurchargePercent: s.listSurchargePercent,
    installmentsEnabled: s.installmentsEnabled,
    installmentsMax: s.installmentsMax,
  };
}

/** PRICING_PREVIEW (solo fuera de producción), o null. */
export function pricingPreview(): PricingSettings | null {
  if (process.env.NODE_ENV === "production") return null;
  return parsePricingPreview(process.env.PRICING_PREVIEW);
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
    envioDomicilio: formatPrice(s.shippingCost),
    // Opcional (no es un dato legal obligatorio): vacío = la frase no aparece.
    despacho: s.dispatchTime.trim(),
    // Medio de pago activo (PAYMENT_PROVIDER): "Getnet" o "Mercado Pago".
    procesador: paymentCopy().name,
  };
}

/**
 * Datos para las PÁGINAS DE INFORMACIÓN (Cómo comprar, Envíos, Contacto…).
 * A diferencia de datosComercio(), lo que falta llega como null y esa parte
 * de la página se omite: los clientes nunca ven "[COMPLETAR]".
 * Los textos están en src/content/informacion.ts.
 */
export type DatosTienda = {
  /** "$ 20.000", o null si el envío es gratis (costo 0). */
  envio: string | null;
  despacho: string | null;
  direccion: string | null;
  horarios: string | null;
  /** Días para cambios por gusto. 0 = no se aceptan. */
  cambiosDias: number;
  email: string | null;
  whatsapp: { numero: string; href: string } | null;
  instagram: { usuario: string; href: string } | null;
  tiktok: { usuario: string; href: string } | null;
  /** Medio de pago activo: "Getnet" o "Mercado Pago". */
  procesador: string;
  /** Frase sobre las cuotas (paymentCopy().installments). */
  cuotas: string;
};

export function datosTienda(s: StoreSettings, mensajeWhatsApp?: string): DatosTienda {
  const whatsapp = whatsappLink(s, mensajeWhatsApp);
  return {
    envio: s.shippingCost > 0 ? formatPrice(s.shippingCost) : null,
    despacho: s.dispatchTime.trim() || null,
    direccion: s.storeAddress.trim() || null,
    horarios: s.storeHours.trim() || null,
    cambiosDias: s.exchangeDays,
    procesador: paymentCopy().name,
    cuotas: paymentCopy().installments,
    email: s.contactEmail.trim() || null,
    whatsapp: whatsapp ? { numero: formatWhatsApp(s.whatsapp), href: whatsapp } : null,
    instagram: s.instagram
      ? { usuario: `@${s.instagram}`, href: `https://www.instagram.com/${s.instagram}/` }
      : null,
    tiktok: s.tiktok ? { usuario: `@${s.tiktok}`, href: `https://www.tiktok.com/@${s.tiktok}` } : null,
  };
}

export type RedSocial = {
  red: "instagram" | "tiktok" | "whatsapp";
  /** Nombre para mostrar y para el lector de pantalla. */
  label: string;
  href: string;
};

/** Mensaje que aparece ya escrito al abrir el WhatsApp de la tienda. */
export const WHATSAPP_MENSAJE = "Hola Home Deko, quería hacer una consulta.";

/**
 * Link para abrir el chat con la tienda con un mensaje ya escrito, o null
 * si todavía no cargaron el número en Configuración.
 */
export function whatsappLink(s: StoreSettings, mensaje: string = WHATSAPP_MENSAJE): string | null {
  if (!s.whatsapp) return null;
  return `https://wa.me/${s.whatsapp}?text=${encodeURIComponent(mensaje)}`;
}

// ---------------------------------------------------------------------------
// Pedidos: datos que pueden faltar (razón social, CUIT y email se cargan
// antes del lanzamiento). Nada de pedidos falla si están vacíos.
// ---------------------------------------------------------------------------

/** Email de los dueños para los avisos de pedidos nuevos, o null si no está cargado. */
export function ownersEmail(s: StoreSettings): string | null {
  return s.contactEmail.trim() || null;
}

/** Remitente del rótulo de envío. Lo que no está cargado, simplemente no aparece. */
export type LabelSender = { name: string; lines: string[] };

export function senderForLabel(s: StoreSettings): LabelSender {
  const lines: string[] = [];
  if (s.businessName.trim() && s.businessName.trim() !== NOMBRE_COMERCIO) lines.push(s.businessName.trim());
  if (s.storeAddress.trim()) lines.push(s.storeAddress.trim());
  if (s.whatsapp) lines.push(`WhatsApp: ${formatWhatsApp(s.whatsapp)}`);
  return { name: NOMBRE_COMERCIO, lines };
}

/** Links a las redes cargadas (las vacías no aparecen). */
export function redesSociales(s: StoreSettings): RedSocial[] {
  const redes: RedSocial[] = [];
  if (s.instagram) {
    redes.push({ red: "instagram", label: "Instagram", href: `https://www.instagram.com/${s.instagram}/` });
  }
  if (s.tiktok) {
    redes.push({ red: "tiktok", label: "TikTok", href: `https://www.tiktok.com/@${s.tiktok}` });
  }
  const whatsapp = whatsappLink(s);
  if (whatsapp) redes.push({ red: "whatsapp", label: "WhatsApp", href: whatsapp });
  return redes;
}
