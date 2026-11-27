import Link from "next/link";
import { X } from "lucide-react";
import {
  activeFilterCount,
  CATALOG_SORTS,
  catalogHref,
  MAX_PAGE,
  normalizeSearch,
  PAGE_SIZE,
  type CatalogParams,
  type CatalogSort,
} from "@/lib/catalog-params";
import type { StoreCategory } from "@/lib/store-data";
import { STORE_CONTAINER } from "@/lib/store-layout";
import { cn } from "@/lib/utils";
import { categoryIdsFor, hrefForCategory, mainCategoryOf, storeTree } from "@/lib/categories";
import { getStoreSettings, pricingFrom } from "@/lib/store-settings";
import { getCatalogForViewer } from "@/lib/store-viewer";
import { ProductGridSkeleton } from "../product-card";
import { NoProducts, ProductGrid } from "../product-grid";
import { CatalogFilters, type FilterCategory } from "./catalog-filters";
import { LoadMore } from "./load-more";
import { MobileFilters } from "./mobile-filters";
import { SortSelect } from "./sort-select";

/**
 * CATÁLOGO: lo comparten /productos, /categorias/[slug] y /buscar.
 *
 *   [PC]      Filtros a la izquierda | cantidad + orden, grilla, "Ver más"
 *   [celular] "Filtrar" (panel desde abajo) + orden, grilla, "Ver más"
 *
 * Todo sale de la URL (src/lib/catalog-params.ts). Lee la sesión (los
 * admins ven borradores) → usar dentro de <Suspense>.
 */

// --- Estructura común de las 3 páginas del catálogo ---------------------------
/** <main>: el ancho de la tienda (alineado con el logo) y poco aire arriba. */
export const CATALOG_MAIN = cn(STORE_CONTAINER, "flex flex-col gap-6 pt-5 pb-14 md:pt-6 lg:gap-8 lg:pb-20");
/** Migas + título (+ descripción o buscador), bien juntos. */
export const CATALOG_HEADER = "flex flex-col gap-1.5";
/** Título compacto: el protagonismo es de las fotos. */
export const CATALOG_TITLE = "font-display text-2xl leading-tight font-semibold tracking-tight md:text-3xl";

/** Columna de filtros (PC) + resultados. 240 px y 48 px de separación. */
const LAYOUT = "flex flex-col gap-5 lg:grid lg:grid-cols-[240px_minmax(0,1fr)] lg:items-start lg:gap-12";

export type CatalogScope =
  | { kind: "all" }
  | { kind: "category"; category: StoreCategory }
  | { kind: "search" };

export async function CatalogView({
  scope,
  params,
  categories,
}: {
  scope: CatalogScope;
  params: CatalogParams;
  /** Categorías visibles, lista plana con subcategorías (para el filtro y las subcategorías). */
  categories: StoreCategory[];
}) {
  const basePath =
    scope.kind === "all" ? "/productos" : scope.kind === "search" ? "/buscar" : hrefForCategory(scope.category, categories);

  // En /buscar la categoría es un filtro (?categoria=); en el resto es la
  // página misma. Un slug que no existe (o una categoría oculta) se ignora.
  const searchCategory =
    scope.kind === "search" && params.categoria ? (categories.find((c) => c.slug === params.categoria) ?? null) : null;
  const p: CatalogParams = {
    ...params,
    q: scope.kind === "search" ? params.q : "",
    categoria: searchCategory?.slug ?? null,
  };

  const pricing = pricingFrom(await getStoreSettings());
  const { products, total } = await getCatalogForViewer({
    // Una principal incluye sus subcategorías (src/lib/categories.ts)
    categoryIds:
      scope.kind === "category"
        ? categoryIdsFor(scope.category, categories)
        : searchCategory
          ? categoryIdsFor(searchCategory, categories)
          : null,
    search: normalizeSearch(p.q),
    orden: p.orden,
    min: p.min,
    max: p.max,
    onSale: p.ofertas,
    limit: PAGE_SIZE * p.pagina,
  });

  // --- Links de los filtros (conservan lo demás y vuelven a la 1.ª tanda) ---
  const keepForCategory = { orden: p.orden, min: p.min, max: p.max, ofertas: p.ofertas };
  // Principales con productos y, debajo de la elegida, sus subcategorías.
  const current = scope.kind === "category" ? scope.category : searchCategory;
  const currentMain = current ? mainCategoryOf(current, categories) : null;
  const toFilter = (c: StoreCategory, sub: boolean): FilterCategory => ({
    slug: c.slug,
    name: c.name,
    sub,
    href:
      scope.kind === "search"
        ? catalogHref(basePath, { ...keepForCategory, q: p.q, categoria: c.slug })
        : catalogHref(hrefForCategory(c, categories), keepForCategory),
    active: scope.kind === "search" ? p.categoria === c.slug : scope.kind === "category" && scope.category.slug === c.slug,
  });
  const filterCategories: FilterCategory[] = storeTree(categories).flatMap((m) => [
    toFilter(m, false),
    ...(currentMain?.id === m.id ? m.children.map((c) => toFilter(c, true)) : []),
  ]);
  const allHref =
    scope.kind === "search" ? catalogHref(basePath, { ...keepForCategory, q: p.q }) : catalogHref("/productos", keepForCategory);

  const keep: Record<string, string> = {};
  if (p.q) keep.q = p.q;
  if (p.categoria) keep.categoria = p.categoria;
  if (p.orden !== "destacados") keep.orden = p.orden;
  if (p.ofertas) keep.ofertas = "1";

  const filterCount = activeFilterCount(p);
  const clearHref = filterCount > 0 ? catalogHref(basePath, { q: p.q, orden: p.orden, ofertas: p.ofertas }) : null;
  // Chip "Ofertas ✕": vuelve a todos los productos, conservando lo demás.
  const removeOnSaleHref = p.ofertas ? catalogHref(basePath, { ...p, ofertas: false, pagina: 1 }) : null;

  const sortHrefs = Object.fromEntries(
    CATALOG_SORTS.map((s) => [s.value, catalogHref(basePath, { ...p, orden: s.value, pagina: 1 })]),
  ) as Record<CatalogSort, string>;

  const filters = (idPrefix: string) => (
    <CatalogFilters
      idPrefix={idPrefix}
      categories={filterCategories}
      allHref={allHref}
      allActive={scope.kind === "all" || (scope.kind === "search" && !p.categoria)}
      price={{ action: basePath, keep, min: p.min, max: p.max }}
      clearHref={clearHref}
    />
  );

  const hasMore = products.length < total;

  return (
    <div className={LAYOUT}>
      <aside aria-label="Filtros" className="hidden lg:block">
        {filters("filtros-pc")}
      </aside>

      <div className="flex min-w-0 flex-col gap-5 lg:gap-6">
        {/* Barra de arriba de la grilla, en UNA línea:
              celular → [Filtrar]  12 productos      [Orden ▾]
              PC      → 12 productos                 Ordenar por [Orden ▾] */}
        {/* flex-wrap: en un celular muy angosto, con filtros activos y muchos
            productos, el orden baja a una segunda línea en vez de desbordar. */}
        <div className="flex min-h-10 flex-wrap items-center gap-x-3 gap-y-2 border-b pb-3">
          <div className="lg:hidden">
            <MobileFilters activeCount={filterCount}>{filters("filtros-celular")}</MobileFilters>
          </div>
          <p aria-live="polite" className="text-sm whitespace-nowrap text-muted-foreground tabular-nums">
            {total === 1 ? "1 producto" : `${total} productos`}
          </p>
          {removeOnSaleHref && (
            <Link
              href={removeOnSaleHref}
              className="inline-flex h-8 items-center gap-1.5 rounded-full bg-brand-soft px-3 text-sm font-semibold text-brand outline-none hover:bg-brand-soft/70 focus-visible:ring-3 focus-visible:ring-ring/30"
            >
              Ofertas
              <X aria-hidden className="size-3.5" />
              <span className="sr-only">(quitar el filtro)</span>
            </Link>
          )}
          {total > 0 && (
            <div className="ml-auto">
              <SortSelect value={p.orden} hrefs={sortHrefs} />
            </div>
          )}
        </div>

        {total > 0 ? (
          <ProductGrid products={products} pricing={pricing} />
        ) : (
          <EmptyState scope={scope} q={p.q} clearHref={clearHref} removeOnSaleHref={removeOnSaleHref} />
        )}

        {hasMore && p.pagina < MAX_PAGE && (
          <LoadMore href={catalogHref(basePath, { ...p, pagina: p.pagina + 1 })} shown={products.length} total={total} />
        )}
        {hasMore && p.pagina >= MAX_PAGE && (
          <p className="text-center text-sm text-muted-foreground">
            Estás viendo {products.length} de {total} productos. Usá los filtros para encontrar más rápido lo que buscás.
          </p>
        )}
      </div>
    </div>
  );
}

/** Mensajes cuando no hay nada para mostrar (pensados para los clientes). */
function EmptyState({
  scope,
  q,
  clearHref,
  removeOnSaleHref,
}: {
  scope: CatalogScope;
  q: string;
  clearHref: string | null;
  removeOnSaleHref: string | null;
}) {
  if (removeOnSaleHref && !clearHref) {
    return (
      <NoProducts
        title="Ahora no hay ofertas"
        text="Volvé pronto: siempre estamos sumando descuentos. Mientras tanto, mirá todos los productos."
        action={{ label: "Ver todos los productos", href: removeOnSaleHref }}
      />
    );
  }
  if (clearHref) {
    return (
      <NoProducts
        title="No hay productos con estos filtros"
        text="Probá con otro rango de precio u otra categoría."
        action={{ label: "Limpiar filtros", href: clearHref }}
      />
    );
  }
  if (scope.kind === "search") {
    return (
      <NoProducts
        title={`No encontramos productos para «${q}»`}
        text="Revisá cómo está escrito o probá con una palabra más general. También podés escribirnos por WhatsApp y te ayudamos a encontrarlo."
      />
    );
  }
  if (scope.kind === "category") {
    return (
      <NoProducts
        title="Pronto vas a encontrar productos acá"
        text="Mientras tanto, mirá el resto de la tienda o escribinos por WhatsApp."
      />
    );
  }
  return (
    <NoProducts
      title="Estamos cargando nuestros productos"
      text="Muy pronto vas a ver acá todo el catálogo. Mientras tanto, escribinos por WhatsApp."
      action={null}
    />
  );
}

/** Mientras carga el catálogo. */
export function CatalogSkeleton() {
  return (
    <div className={LAYOUT}>
      <div className="hidden flex-col gap-3 lg:flex">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-4 w-3/4 animate-pulse rounded bg-muted" />
        ))}
      </div>
      <div className="flex flex-col gap-5 lg:gap-6">
        <div className="flex min-h-10 items-center justify-between border-b pb-3">
          <div className="h-5 w-24 animate-pulse rounded bg-muted" />
          <div className="h-9 w-40 animate-pulse rounded-full bg-muted" />
        </div>
        <ProductGridSkeleton count={8} variant="catalog" />
      </div>
    </div>
  );
}
