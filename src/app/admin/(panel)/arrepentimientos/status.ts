/**
 * Estados de las solicitudes del Botón de arrepentimiento (tabla
 * withdrawal_requests). Los comparten la lista, el detalle y el Inicio.
 */
export type WithdrawalStatus = "new" | "in_progress" | "resolved" | "rejected";

export const STATUS_LABELS: Record<WithdrawalStatus, string> = {
  new: "Nueva",
  in_progress: "En gestión",
  resolved: "Resuelta",
  rejected: "No corresponde",
};

/** Mismos colores que el resto del panel: ámbar = hay que hacer algo; verde = listo; gris = cerrado. */
export const STATUS_STYLES: Record<WithdrawalStatus, string> = {
  new: "bg-amber-50 text-amber-800",
  in_progress: "bg-sky-50 text-sky-800",
  resolved: "bg-emerald-50 text-emerald-700",
  rejected: "bg-secondary text-muted-foreground",
};

/** Pestañas de la lista (?estado=). */
export const TABS = {
  nuevas: { label: "Nuevas", statuses: ["new"] },
  gestion: { label: "En gestión", statuses: ["in_progress"] },
  cerradas: { label: "Cerradas", statuses: ["resolved", "rejected"] },
  todas: { label: "Todas", statuses: ["new", "in_progress", "resolved", "rejected"] },
} as const satisfies Record<string, { label: string; statuses: WithdrawalStatus[] }>;

export type WithdrawalTab = keyof typeof TABS;

export function parseTab(value: unknown): WithdrawalTab {
  return typeof value === "string" && value in TABS ? (value as WithdrawalTab) : "nuevas";
}

export const LIST_PATH = "/admin/arrepentimientos";

/** "hace 5 minutos", "hace 3 horas", "hace 2 días". */
export function timeAgo(iso: string, now: number): string {
  const minutes = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return "recién";
  if (minutes < 60) return minutes === 1 ? "hace 1 minuto" : `hace ${minutes} minutos`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return hours === 1 ? "hace 1 hora" : `hace ${hours} horas`;
  const days = Math.round(hours / 24);
  return days === 1 ? "hace 1 día" : `hace ${days} días`;
}
