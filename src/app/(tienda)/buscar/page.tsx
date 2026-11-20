import type { Metadata } from "next";
import { Suspense } from "react";
import { Breadcrumbs } from "@/components/store/catalog/breadcrumbs";
import {
  CATALOG_HEADER,
  CATALOG_MAIN,
  CATALOG_TITLE,
  CatalogSkeleton,
  CatalogView,
} from "@/components/store/catalog/catalog-view";
import { cn } from "@/lib/utils";
import { NoProducts } from "@/components/store/product-grid";
import { SearchForm } from "@/components/store/search-form";
import { MAX_SEARCH_LENGTH, parseCatalogParams } from "@/lib/catalog-params";
import { getVisibleCategories } from "@/lib/store-data";
import { SEARCH_PATH } from "@/lib/store-nav";

/**
 * /buscar?q=… — resultados del buscador del encabezado.
 *
 * No distingue mayúsculas ni tildes ("sabana" encuentra "Sábana") y busca
 * en el nombre, la categoría y el código de barras (vista store_products,
 * columna search_text). Se puede filtrar por categoría (?categoria=) y precio.
 *
 * Google: título y descripción con la búsqueda, pero "noindex, follow":
 * Google pide no indexar resultados de búsquedas internas (son infinitos y
 * repiten el catálogo); sí sigue los links a los productos.
 */
export async function generateMetadata({ searchParams }: PageProps<"/buscar">): Promise<Metadata> {
  const { q } = await searchParams;
  const term = (typeof q === "string" ? q : "").trim().slice(0, MAX_SEARCH_LENGTH);
  return {
    title: term ? `Resultados para «${term}»` : "Buscar",
    description: term
      ? `Productos de Home Deko para «${term}»: artículos del hogar, bazar y blanquería.`
      : "Buscá entre todos los productos de Home Deko: artículos del hogar, bazar y blanquería.",
    robots: { index: false, follow: true },
  };
}

export default function SearchPage({ searchParams }: PageProps<"/buscar">) {
  return (
    <main className={CATALOG_MAIN}>
      <Suspense fallback={<CatalogSkeleton />}>
        <SearchResults searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function SearchResults({ searchParams }: Pick<PageProps<"/buscar">, "searchParams">) {
  const [sp, categories] = await Promise.all([searchParams, getVisibleCategories()]);
  const params = parseCatalogParams(sp);

  return (
    <>
      <header className={CATALOG_HEADER}>
        <Breadcrumbs items={[{ label: "Búsqueda", href: SEARCH_PATH }]} />
        <h1 className={cn(CATALOG_TITLE, "break-words")}>
          {params.q ? <>Resultados para «{params.q}»</> : "¿Qué estás buscando?"}
        </h1>
        {/* Para corregir la búsqueda sin volver a escribir todo */}
        <SearchForm inputId="buscar-pagina" defaultValue={params.q} className="mt-2 max-w-md" />
      </header>

      {params.q ? (
        <CatalogView scope={{ kind: "search" }} params={params} categories={categories} />
      ) : (
        <NoProducts
          title="Escribí lo que buscás"
          text="Por ejemplo: sábanas, tazas, manteles o velas. O mirá todo el catálogo."
        />
      )}
    </>
  );
}
