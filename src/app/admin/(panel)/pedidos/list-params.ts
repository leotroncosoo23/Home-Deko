/**
 * Filtros de la lista de pedidos, guardados en la URL:
 *   /admin/pedidos?estado=preparando&q=perez&entrega=envio&pagina=2
 *
 * Así, al volver del detalle de un pedido (o al recargar) la lista queda
 * igual. Lo usan el servidor (para consultar) y el navegador (para cambiar la URL).
 */

export const PAGE_SIZE = 50;

/** Pestañas, en el orden en que se despacha un pedido. */
export const TABS = {
  preparar: "Para preparar",
  preparando: "Preparando",
  enviados: "Enviados",
  retirar: "Para retirar",
  listos: "Entregados y retirados",
  todos: "Todos",
  // Sin pestaña propia: se llega desde los avisos de arriba
  atencion: "Requieren atención",
} as const;
export type Tab = keyof typeof TABS;

export const DELIVERY_FILTERS = {
  todas: "Envío y retiro",
  envio: "Solo envíos",
  retiro: "Solo retiros",
} as const;
export type DeliveryFilter = keyof typeof DELIVERY_FILTERS;

export type ListParams = {
  estado: Tab;
  q: string;
  entrega: DeliveryFilter;
  /** Solo en "Todos": sumar los intentos que quedaron sin pagar. */
  sinPagar: boolean;
  pagina: number;
};

export const DEFAULT_PARAMS: ListParams = { estado: "preparar", q: "", entrega: "todas", sinPagar: false, pagina: 1 };

type RawParams = Record<string, string | string[] | undefined>;

export function parseListParams(raw: RawParams): ListParams {
  const get = (key: string) => {
    const value = raw[key];
    return typeof value === "string" ? value : Array.isArray(value) ? value[0] : undefined;
  };
  const pick = <T extends string>(value: string | undefined, options: Record<T, string>, fallback: T): T =>
    value && value in options ? (value as T) : fallback;
  const page = Number(get("pagina"));
  const estado = pick(get("estado"), TABS, DEFAULT_PARAMS.estado);
  return {
    estado,
    q: (get("q") ?? "").slice(0, 100),
    entrega: pick(get("entrega"), DELIVERY_FILTERS, "todas"),
    sinPagar: estado === "todos" && get("sinpagar") === "1",
    pagina: Number.isInteger(page) && page > 1 && page < 10_000 ? page : 1,
  };
}

export function toQueryString(params: ListParams): string {
  const search = new URLSearchParams();
  if (params.estado !== DEFAULT_PARAMS.estado) search.set("estado", params.estado);
  if (params.q.trim()) search.set("q", params.q.trim());
  if (params.entrega !== "todas") search.set("entrega", params.entrega);
  if (params.sinPagar && params.estado === "todos") search.set("sinpagar", "1");
  if (params.pagina > 1) search.set("pagina", String(params.pagina));
  const text = search.toString();
  return text ? `?${text}` : "";
}

export const LIST_PATH = "/admin/pedidos";

/**
 * Lo que escribió la persona → filtro seguro para la búsqueda. Saca los
 * caracteres que en el filtro funcionan como comodines (% _ *) o lo rompen
 * (, ( ) \). Las tildes se dejan: los nombres se guardan con tildes.
 */
export function cleanSearch(text: string): string {
  return text.replace(/[%_*\\,()"]/g, " ").replace(/\s+/g, " ").trim();
}

/** "#1023" o "1023" → 1023 (búsqueda por número de pedido). */
export function searchNumber(text: string): number | null {
  const m = /^#?\s*(\d{1,9})$/.exec(text.trim());
  return m ? Number(m[1]) : null;
}
