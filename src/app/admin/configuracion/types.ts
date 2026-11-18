/**
 * Tipos compartidos entre el servidor (data.ts, actions.ts) y los
 * componentes del navegador. No importa nada del servidor.
 */
import type { SettingsField } from "./schema";

/** La configuración tal como la muestra el panel. */
export type AdminSettings = {
  isLaunched: boolean;
  whatsapp: string;
  instagram: string;
  tiktok: string;
  shippingCost: number;
  storeAddress: string;
  storeHours: string;
  exchangeDays: number;
  businessName: string;
  cuit: string;
  contactEmail: string;
};

/** Lo que devuelve cada Server Action: o salió bien, o un mensaje claro. */
export type ActionResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Partial<Record<SettingsField, string>> };
