import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { categoryMetadata, CategoryPageView } from "@/components/store/catalog/category-page";
import { getVisibleCategories, type StoreCategory } from "@/lib/store-data";

/**
 * /categorias/[slug]/[sub] — una SUBCATEGORÍA visible dentro de su
 * principal (/categorias/cocina/utensilios): migas Inicio › Cocina ›
 * Utensilios, los chips de la principal con la actual marcada, título,
 * descripción y canonical propios.
 *
 * Si la subcategoría no es de esa principal (o alguna está oculta) → 404.
 */

/** Las subcategorías visibles se arman de antemano. */
export async function generateStaticParams() {
  const categories = await getVisibleCategories();
  const params = categories.flatMap((sub) => {
    const main = sub.parentId ? categories.find((c) => c.id === sub.parentId) : null;
    return main ? [{ slug: main.slug, sub: sub.slug }] : [];
  });
  // Con cacheComponents hace falta al menos uno para validar la ruta al compilar.
  return params.length > 0 ? params : [{ slug: "inicio", sub: "inicio" }];
}

async function findPair(slug: string, subSlug: string): Promise<{ main: StoreCategory; sub: StoreCategory } | null> {
  const categories = await getVisibleCategories();
  const main = categories.find((c) => c.slug === slug && c.parentId === null);
  const sub = main ? categories.find((c) => c.slug === subSlug && c.parentId === main.id) : null;
  return main && sub ? { main, sub } : null;
}

export async function generateMetadata({ params }: PageProps<"/categorias/[slug]/[sub]">): Promise<Metadata> {
  const { slug, sub } = await params;
  const pair = await findPair(slug, sub);
  if (!pair) return { title: "No encontramos esta página" };
  return categoryMetadata(pair.sub, pair.main);
}

export default async function SubcategoryPage({ params, searchParams }: PageProps<"/categorias/[slug]/[sub]">) {
  const { slug, sub } = await params;
  const pair = await findPair(slug, sub);
  if (!pair) notFound();
  return <CategoryPageView main={pair.main} sub={pair.sub} searchParams={searchParams} />;
}
