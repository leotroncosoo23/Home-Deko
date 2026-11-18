import type { Metadata } from "next";
import { Suspense } from "react";
import { NoProducts, ProductGrid } from "@/components/store/product-grid";
import { ProductGridSkeleton } from "@/components/store/product-card";
import { getProductsForViewer } from "@/lib/store-viewer";

export const metadata: Metadata = {
  title: "Productos",
  description: "Todos los productos de Home Deko: artículos del hogar, bazar y blanquería.",
};

/**
 * /productos — todos los productos, y los resultados del buscador (?q=).
 * Versión simple: los filtros, el orden y la paginación se suman con el
 * catálogo completo (paso 2).
 *
 * Lee la URL y la sesión (borradores para admins) → todo en <Suspense>.
 */
export default function ProductsPage({ searchParams }: PageProps<"/productos">) {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10 md:px-6 md:py-14">
      <Suspense fallback={<ProductsSkeleton />}>
        <Products searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Products({ searchParams }: Pick<PageProps<"/productos">, "searchParams">) {
  const { q } = await searchParams;
  const search = (typeof q === "string" ? q : "").trim();
  const products = await getProductsForViewer({ search });

  return (
    <>
      <header className="flex flex-col items-center gap-2 text-center">
        <h1 className="font-display text-4xl leading-tight font-semibold tracking-tight md:text-5xl">
          {search ? "Resultados" : "Todos los productos"}
        </h1>
        {search && (
          <p className="text-[17px] text-muted-foreground">
            {products.length === 1 ? "1 producto" : `${products.length} productos`} para «{search}»
          </p>
        )}
      </header>

      {products.length > 0 ? (
        <ProductGrid products={products} />
      ) : search ? (
        <NoProducts
          title="No encontramos productos"
          text="Probá con otra palabra, o escribinos por WhatsApp y te ayudamos a encontrarlo."
        />
      ) : (
        <NoProducts
          title="Estamos cargando nuestros productos"
          text="Muy pronto vas a ver acá todo el catálogo. Mientras tanto, escribinos por WhatsApp."
          showAllLink={false}
        />
      )}
    </>
  );
}

function ProductsSkeleton() {
  return (
    <>
      <div className="mx-auto h-12 w-72 max-w-full animate-pulse rounded-lg bg-muted" />
      <ProductGridSkeleton count={8} />
    </>
  );
}
