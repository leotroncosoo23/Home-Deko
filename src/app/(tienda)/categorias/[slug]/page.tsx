import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ProductGridSkeleton } from "@/components/store/product-card";
import { NoProducts, ProductGrid } from "@/components/store/product-grid";
import { getVisibleCategories, getVisibleCategoryBySlug } from "@/lib/store-data";
import { getProductsForViewer } from "@/lib/store-viewer";

/**
 * /categorias/[slug] — los productos de una categoría visible.
 * Versión simple: los filtros y el orden se suman con el catálogo (paso 2).
 */

/** Las categorías visibles se arman de antemano (el resto: 404). */
export async function generateStaticParams() {
  const categories = await getVisibleCategories();
  // Con cacheComponents hace falta al menos uno para validar la ruta al compilar.
  return categories.length > 0 ? categories.map((c) => ({ slug: c.slug })) : [{ slug: "inicio" }];
}

export async function generateMetadata({ params }: PageProps<"/categorias/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const category = await getVisibleCategoryBySlug(slug);
  return category ? { title: category.name } : { title: "No encontramos esta página" };
}

export default async function CategoryPage({ params }: PageProps<"/categorias/[slug]">) {
  const { slug } = await params;
  const category = await getVisibleCategoryBySlug(slug);
  if (!category) notFound();

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10 md:px-6 md:py-14">
      <h1 className="text-center font-display text-4xl leading-tight font-semibold tracking-tight md:text-5xl">
        {category.name}
      </h1>
      {/* Los productos leen la sesión (borradores para admins) */}
      <Suspense fallback={<ProductGridSkeleton count={8} />}>
        <CategoryProducts categoryId={category.id} />
      </Suspense>
    </main>
  );
}

async function CategoryProducts({ categoryId }: { categoryId: string }) {
  const products = await getProductsForViewer({ categoryId });
  if (products.length === 0) {
    return (
      <NoProducts
        title="Pronto vas a encontrar productos acá"
        text="Mientras tanto, mirá el resto de la tienda o escribinos por WhatsApp."
      />
    );
  }
  return <ProductGrid products={products} />;
}
