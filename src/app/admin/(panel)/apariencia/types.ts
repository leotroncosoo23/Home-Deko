import type { BannerBackground, BannerKind, BannerView } from "@/lib/banners";

/**
 * Tipos compartidos entre el servidor (data.ts, actions.ts) y los
 * componentes del navegador. No importa nada del servidor.
 */

/**
 * Estado de un banner HOY:
 *   live      → activo y dentro de sus fechas (puede verse en la tienda)
 *   scheduled → activo, pero empieza más adelante
 *   ended     → activo, pero ya pasó su fecha de fin
 *   paused    → apagado a mano
 */
export type BannerStatus = "live" | "scheduled" | "ended" | "paused";

/** Un banner tal como lo muestra el panel. */
export type AdminBanner = BannerView & {
  id: string;
  productImagePath: string | null;
  imagePath: string | null;
  imageMobilePath: string | null;
  /** Días en hora de Argentina ("2026-12-01"); "" = sin fecha. */
  startsOn: string;
  endsOn: string;
  isActive: boolean;
  status: BannerStatus;
  /** true si es EL que se ve hoy en la tienda (si hay varios vigentes, uno solo). */
  isShowing: boolean;
  updatedAt: string;
};

/** Lo que se escribe en el formulario (todo texto, como en los campos). */
export type BannerFormValues = {
  kind: BannerKind;
  title: string;
  body: string;
  buttonLabel: string;
  buttonUrl: string;
  background: BannerBackground;
  startsOn: string;
  endsOn: string;
  isActive: boolean;
};

/** Campos que pueden tener un error para mostrar. */
export type BannerField =
  | keyof BannerFormValues
  | "productImage"
  | "image"
  | "imageMobile";

export type ActionResult =
  | { ok: true; id: string }
  | { ok: false; error: string; fieldErrors?: Partial<Record<BannerField, string>> };

export const BANNER_STATUS_LABELS: Record<BannerStatus, string> = {
  live: "Se ve ahora",
  scheduled: "Programado",
  ended: "Terminado",
  paused: "Pausado",
};
