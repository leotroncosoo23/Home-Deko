import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/store/catalog/breadcrumbs";
import {
  CATALOG_HEADER,
  CATALOG_MAIN,
  CATALOG_TITLE,
  CatalogSkeleton,
  CatalogView,
} from "@/components/store/catalog/catalog-view";
import { parseCatalogParams } from "@/lib/catalog-params";
import { getVisibleCategories, getVisibleCategoryBySlug, type StoreCategory } from "@/lib/store-data";
import { categoryHref } from "@/lib/store-nav";

/**
 * /categorias/[slug] — los productos de una categoría visible, con
 * filtros, orden y "Ver más". Categoría oculta o inexistente → 404.
 */

/** Las categorías visibles se arman de antemano (el resto: 404). */
export async function generateStaticParams() {
  const categories = await getVisibleCategories();
  // Con cacheComponents hace falta al menos uno para validar la ruta al compilar.
  return categories.length > 0 ? categories.map((c) => ({ slug: c.slug })) : [{ slug: "inicio" }];
}

/** Descripción para Google: la que cargaron en el panel, o una armada con el nombre. */
function categoryDescription(category: StoreCategory): string {
  return (
    category.description ??
    `${category.name} en Home Deko: artículos del hogar, bazar y blanquería. Comprá online con envío a todo el país o retiro en el local en Trevelin, Chubut.`
  ).slice(0, 300);
}

export async function generateMetadata({ params }: PageProps<"/categorias/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const category = await getVisibleCategoryBySlug(slug);
  if (!category) return { title: "No encontramos esta página" };

  const description = categoryDescription(category);
  return {
    title: category.name,
    description,
    // Una sola dirección para Google, sin importar el orden o los filtros elegidos.
    alternates: { canonical: categoryHref(category.slug) },
    openGraph: {
      title: `${category.name} · Home Deko`,
      description,
      ...(category.imageUrl ? { images: [{ url: category.imageUrl }] } : {}),
    },
  };
}

export default async function CategoryPage({ params, searchParams }: PageProps<"/categorias/[slug]">) {
  const { slug } = await params;
  const category = await getVisibleCategoryBySlug(slug);
  if (!category) notFound();

  return (
    <main className={CATALOG_MAIN}>
      <header className={CATALOG_HEADER}>
        <Breadcrumbs items={[{ label: category.name, href: categoryHref(category.slug) }]} />
        <h1 className={CATALOG_TITLE}>{category.name}</h1>
        {category.description && (
          <p className="max-w-2xl text-[15px] leading-6 text-muted-foreground">{category.description}</p>
        )}
      </header>
      {/* Lee la URL (filtros) y la sesión (borradores para admins) */}
      <Suspense fallback={<CatalogSkeleton />}>
        <CategoryProducts category={category} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function CategoryProducts({
  category,
  searchParams,
}: { category: StoreCategory } & Pick<PageProps<"/categorias/[slug]">, "searchParams">) {
  const [sp, categories] = await Promise.all([searchParams, getVisibleCategories()]);
  return <CatalogView scope={{ kind: "category", category }} params={parseCatalogParams(sp)} categories={categories} />;
}
