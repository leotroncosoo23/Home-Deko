/**
 * PARÁMETROS DEL CATÁLOGO EN LA URL
 *
 *   /productos?orden=menor-precio&min=5000&max=20000&pagina=2
 *   /categorias/bazar?orden=nuevos
 *   /buscar?q=sabana&categoria=blanqueria
 *   /productos?ofertas=1          (solo con descuento: el "Ver todos" de Ofertas del inicio)
 *
 * Todo el estado del catálogo vive en la URL: así un link se puede
 * compartir y el botón "atrás" vuelve exactamente a lo que se veía.
 *
 * Lo que venga mal escrito en la URL (a mano o de un link viejo) se
 * ignora y se usa el valor por defecto: nunca un error para el cliente.
 * Los valores por defecto NO se escriben en la URL (links más limpios).
 *
 * Sin "server-only": lo usan también los componentes del navegador para
 * armar los links.
 */

export const CATALOG_SORTS = [
  { value: "destacados", label: "Destacados" },
  { value: "nuevos", label: "Más nuevos" },
  { value: "menor-precio", label: "Menor precio" },
  { value: "mayor-precio", label: "Mayor precio" },
] as const;

export type CatalogSort = (typeof CATALOG_SORTS)[number]["value"];
export const DEFAULT_SORT: CatalogSort = "destacados";

/** Productos por tanda ("Ver más" suma otra tanda). */
export const PAGE_SIZE = 24;
/** Tope de tandas: 20 × 24 = 480 productos en una página, para que nadie pida miles de una vez. */
export const MAX_PAGE = 20;

/** Largo máximo de una búsqueda. */
export const MAX_SEARCH_LENGTH = 80;

/** Precio máximo que se acepta en el filtro (evita números absurdos). */
const MAX_PRICE = 100_000_000;

export type CatalogParams = {
  orden: CatalogSort;
  /** Precio mínimo y máximo en pesos (lo que paga el cliente), o null. */
  min: number | null;
  max: number | null;
  /** Solo productos con descuento vigente (?ofertas=1). */
  ofertas: boolean;
  /** Cuántas tandas de PAGE_SIZE se muestran (1 = la primera). */
  pagina: number;
  /** Solo en /buscar. */
  q: string;
  /** Solo en /buscar: slug de la categoría elegida en el filtro. */
  categoria: string | null;
};

export type SearchParamsRecord = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

/** "12.000", "$ 12000" o "12000" → 12000. Vacío o inválido → null. */
function parsePrice(value: string): number | null {
  const digits = value.split(",")[0].replace(/\D/g, ""); // se ignoran los centavos
  if (!digits) return null;
  const n = Number(digits);
  return Number.isFinite(n) ? Math.min(n, MAX_PRICE) : null;
}

export function parseCatalogParams(sp: SearchParamsRecord): CatalogParams {
  const orden = first(sp.orden);
  const sort = CATALOG_SORTS.some((s) => s.value === orden) ? (orden as CatalogSort) : DEFAULT_SORT;

  let min = parsePrice(first(sp.min));
  let max = parsePrice(first(sp.max));
  if (min === 0) min = null; // "desde $ 0" = sin mínimo
  // Si los pusieron al revés, se invierten solos.
  if (min !== null && max !== null && min > max) [min, max] = [max, min];

  const page = Number.parseInt(first(sp.pagina), 10);
  const categoria = first(sp.categoria).trim();

  return {
    orden: sort,
    min,
    max,
    ofertas: first(sp.ofertas) === "1",
    pagina: Number.isFinite(page) ? Math.min(Math.max(page, 1), MAX_PAGE) : 1,
    q: first(sp.q).trim().slice(0, MAX_SEARCH_LENGTH),
    categoria: /^[a-z0-9-]{1,100}$/.test(categoria) ? categoria : null,
  };
}

/** ¿Cuántos filtros eligió el cliente? (para el botón "Filtrar (2)"). La búsqueda no cuenta. */
// "Ofertas" no cuenta: no está en el panel de filtros, se saca con su propio chip.
export function activeFilterCount(p: Pick<CatalogParams, "min" | "max" | "categoria">): number {
  return (p.min !== null || p.max !== null ? 1 : 0) + (p.categoria ? 1 : 0);
}

/**
 * Link a una página del catálogo con estos parámetros. Omite los valores
 * por defecto (orden "destacados", página 1, sin precio).
 */
export function catalogHref(path: string, p: Partial<CatalogParams>): string {
  const sp = new URLSearchParams();
  if (p.q) sp.set("q", p.q);
  if (p.categoria) sp.set("categoria", p.categoria);
  if (p.ofertas) sp.set("ofertas", "1");
  if (p.orden && p.orden !== DEFAULT_SORT) sp.set("orden", p.orden);
  if (p.min != null) sp.set("min", String(p.min));
  if (p.max != null) sp.set("max", String(p.max));
  if (p.pagina && p.pagina > 1) sp.set("pagina", String(p.pagina));
  const query = sp.toString();
  return query ? `${path}?${query}` : path;
}

/**
 * Texto de búsqueda en minúsculas y sin tildes, igual que la columna
 * search_text de la vista store_products (unaccent + lower en la base).
 * "SÁBANA" → "sabana". La ñ también pasa a n, igual que unaccent.
 */
export function normalizeSearch(text: string): string {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}
