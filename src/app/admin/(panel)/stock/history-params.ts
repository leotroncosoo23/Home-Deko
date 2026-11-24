import { REASON_LABELS, type StockReason } from "./reasons";

/**
 * Filtros de /admin/stock, en la URL (así se pueden compartir y se
 * mantienen al recargar):
 *   ?desde=2026-11-01&hasta=2026-11-30&motivo=rotura&q=taza&pid=<id>&pagina=2&reponer=sin
 */

export const HISTORY_PAGE_SIZE = 50;

export type RestockFilter = "todas" | "sin" | "bajo";

export type HistoryParams = {
  /** Días "AAAA-MM-DD" (hora de Argentina) o "". */
  desde: string;
  hasta: string;
  motivo: StockReason | null;
  /** Busca por producto, variante, SKU o código. */
  q: string;
  /** Un producto puntual (desde "Ver todo el historial" en la edición). */
  pid: string | null;
  pagina: number;
  reponer: RestockFilter;
};

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Raw = Record<string, string | string[] | undefined>;

export function parseHistoryParams(raw: Raw): HistoryParams {
  const get = (k: string) => {
    const v = raw[k];
    return typeof v === "string" ? v : Array.isArray(v) ? v[0] : undefined;
  };
  const motivo = get("motivo");
  const page = Number(get("pagina"));
  const reponer = get("reponer");
  return {
    desde: DAY.test(get("desde") ?? "") ? (get("desde") as string) : "",
    hasta: DAY.test(get("hasta") ?? "") ? (get("hasta") as string) : "",
    motivo: motivo && motivo in REASON_LABELS ? (motivo as StockReason) : null,
    q: (get("q") ?? "").slice(0, 100),
    pid: UUID.test(get("pid") ?? "") ? (get("pid") as string) : null,
    pagina: Number.isInteger(page) && page > 1 && page < 10_000 ? page : 1,
    reponer: reponer === "sin" || reponer === "bajo" ? reponer : "todas",
  };
}

export function historyQueryString(p: HistoryParams): string {
  const s = new URLSearchParams();
  if (p.desde) s.set("desde", p.desde);
  if (p.hasta) s.set("hasta", p.hasta);
  if (p.motivo) s.set("motivo", p.motivo);
  if (p.q.trim()) s.set("q", p.q.trim());
  if (p.pid) s.set("pid", p.pid);
  if (p.pagina > 1) s.set("pagina", String(p.pagina));
  if (p.reponer !== "todas") s.set("reponer", p.reponer);
  const text = s.toString();
  return text ? `?${text}` : "";
}

export function hasHistoryFilters(p: HistoryParams): boolean {
  return Boolean(p.desde || p.hasta || p.motivo || p.q.trim() || p.pid);
}
