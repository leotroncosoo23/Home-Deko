/**
 * Filtros del listado de productos, guardados en la URL:
 *   /admin/productos?q=taza&cat=<id>&estado=publicados&stock=bajo&orden=precio-asc&pagina=2
 *
 * Así, al volver de editar un producto (o al recargar, o al compartir el
 * enlace) el listado queda igual. Este archivo lo usan el servidor (para
 * consultar) y el navegador (para cambiar la URL).
 */

export const PAGE_SIZE = 25;

export const STATUS_FILTERS = {
  activos: "Activos (borrador y publicado)",
  publicados: "Publicados",
  borradores: "Borradores",
  archivados: "Archivados",
  todos: "Todos",
} as const;
export type StatusFilter = keyof typeof STATUS_FILTERS;

export const STOCK_FILTERS = {
  todos: "Todo el stock",
  bajo: "Stock bajo",
  sin: "Sin stock",
} as const;
export type StockFilter = keyof typeof STOCK_FILTERS;

export const SORTS = {
  recientes: "Más recientes",
  "nombre-asc": "Nombre (A-Z)",
  "nombre-desc": "Nombre (Z-A)",
  "precio-asc": "Precio: menor a mayor",
  "precio-desc": "Precio: mayor a menor",
  "stock-asc": "Stock: menor a mayor",
  "stock-desc": "Stock: mayor a menor",
} as const;
export type SortKey = keyof typeof SORTS;

/** "sin" = productos sin categoría. */
export const NO_CATEGORY = "sin";

export type ListParams = {
  q: string;
  /** id de categoría, "sin" (sin categoría) o null (todas). */
  cat: string | null;
  estado: StatusFilter;
  stock: StockFilter;
  orden: SortKey;
  pagina: number;
};

export const DEFAULT_PARAMS: ListParams = {
  q: "",
  cat: null,
  estado: "activos",
  stock: "todos",
  orden: "recientes",
  pagina: 1,
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RawParams = Record<string, string | string[] | undefined>;

/** De la URL a filtros válidos (lo que no se entiende, vuelve al valor por defecto). */
export function parseListParams(raw: RawParams): ListParams {
  const get = (key: string) => {
    const value = raw[key];
    return typeof value === "string" ? value : Array.isArray(value) ? value[0] : undefined;
  };
  const pick = <T extends string>(value: string | undefined, options: Record<T, string>, fallback: T): T =>
    value && value in options ? (value as T) : fallback;

  const cat = get("cat");
  const page = Number(get("pagina"));
  return {
    q: (get("q") ?? "").slice(0, 100),
    cat: cat === NO_CATEGORY || (cat && UUID_PATTERN.test(cat)) ? cat : null,
    estado: pick(get("estado"), STATUS_FILTERS, DEFAULT_PARAMS.estado),
    stock: pick(get("stock"), STOCK_FILTERS, DEFAULT_PARAMS.stock),
    orden: pick(get("orden"), SORTS, DEFAULT_PARAMS.orden),
    pagina: Number.isInteger(page) && page > 1 && page < 10_000 ? page : 1,
  };
}

/** De filtros a "?q=…&…" (sin los que están en su valor por defecto). */
export function toQueryString(params: ListParams): string {
  const search = new URLSearchParams();
  if (params.q.trim()) search.set("q", params.q.trim());
  if (params.cat) search.set("cat", params.cat);
  if (params.estado !== DEFAULT_PARAMS.estado) search.set("estado", params.estado);
  if (params.stock !== DEFAULT_PARAMS.stock) search.set("stock", params.stock);
  if (params.orden !== DEFAULT_PARAMS.orden) search.set("orden", params.orden);
  if (params.pagina > 1) search.set("pagina", String(params.pagina));
  const text = search.toString();
  return text ? `?${text}` : "";
}

/** ¿Hay algún filtro puesto? (para mostrar "Limpiar filtros") */
export function hasFilters(params: ListParams): boolean {
  return Boolean(params.q.trim() || params.cat || params.estado !== "activos" || params.stock !== "todos");
}

/**
 * Texto de búsqueda como lo guarda la base: minúsculas y sin tildes.
 * También saca los caracteres que en la búsqueda funcionan como comodines
 * (% _ * \) o que rompen el filtro (, ( )).
 */
export function normalizeSearch(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[%_*\\,()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
