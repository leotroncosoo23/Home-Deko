import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Breadcrumbs } from "@/components/store/catalog/breadcrumbs";
import {
  CATALOG_HEADER,
  CATALOG_MAIN,
  CATALOG_TITLE,
  CatalogSkeleton,
  CatalogView,
} from "@/components/store/catalog/catalog-view";
import { parseCatalogParams } from "@/lib/catalog-params";
import { getVisibleCategories } from "@/lib/store-data";
import { ALL_PRODUCTS_LINK, SEARCH_PATH } from "@/lib/store-nav";

const DESCRIPTION =
  "Todos los productos de Home Deko: artículos del hogar, bazar y blanquería. Comprá online con envío a todo el país o retiro en el local en Trevelin, Chubut.";

export const metadata: Metadata = {
  title: "Todos los productos",
  description: DESCRIPTION,
  // Una sola dirección para Google, sin importar el orden o los filtros elegidos.
  alternates: { canonical: "/productos" },
  openGraph: { title: "Todos los productos · Home Deko", description: DESCRIPTION },
};

/**
 * /productos — todo el catálogo, con filtros, orden y "Ver más".
 * La URL (?orden=&min=&max=&pagina=) se lee dentro de <Suspense>.
 */
export default function ProductsPage({ searchParams }: PageProps<"/productos">) {
  return (
    <main className={CATALOG_MAIN}>
      <header className={CATALOG_HEADER}>
        <Breadcrumbs items={[{ label: ALL_PRODUCTS_LINK.label, href: ALL_PRODUCTS_LINK.href }]} />
        {/* "Ofertas" con ?ofertas=1 (el "Ver todos" de la tira del inicio). La URL
            se lee dentro de <Suspense>; mientras tanto, el título de siempre. */}
        <Suspense fallback={<h1 className={CATALOG_TITLE}>Todos los productos</h1>}>
          <ProductsTitle searchParams={searchParams} />
        </Suspense>
      </header>
      <Suspense fallback={<CatalogSkeleton />}>
        <Products searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function ProductsTitle({ searchParams }: Pick<PageProps<"/productos">, "searchParams">) {
  const { ofertas } = parseCatalogParams(await searchParams);
  return <h1 className={CATALOG_TITLE}>{ofertas ? "Ofertas" : "Todos los productos"}</h1>;
}

async function Products({ searchParams }: Pick<PageProps<"/productos">, "searchParams">) {
  const sp = await searchParams;
  // Links viejos del buscador (/productos?q=…): ahora la búsqueda está en /buscar.
  if (typeof sp.q === "string" && sp.q.trim()) {
    redirect(`${SEARCH_PATH}?q=${encodeURIComponent(sp.q.trim())}`);
  }

  const categories = await getVisibleCategories();
  return <CatalogView scope={{ kind: "all" }} params={parseCatalogParams(sp)} categories={categories} />;
}
