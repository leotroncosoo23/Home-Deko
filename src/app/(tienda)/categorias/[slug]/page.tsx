import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { categoryMetadata, CategoryPageView } from "@/components/store/catalog/category-page";
import { getVisibleCategories, getVisibleCategoryBySlug } from "@/lib/store-data";
import { categoryHref } from "@/lib/store-nav";

/**
 * /categorias/[slug] — una categoría PRINCIPAL visible: sus productos y los
 * de sus subcategorías, con chips, filtros, orden y "Ver más".
 *
 * Si el slug es de una subcategoría (/categorias/utensilios), redirige en
 * forma permanente (308) a su URL anidada /categorias/cocina/utensilios.
 * Oculta o inexistente → 404.
 */

/** Las principales visibles se arman de antemano (el resto: 404 o redirección). */
export async function generateStaticParams() {
  const mains = (await getVisibleCategories()).filter((c) => c.parentId === null);
  // Con cacheComponents hace falta al menos uno para validar la ruta al compilar.
  return mains.length > 0 ? mains.map((c) => ({ slug: c.slug })) : [{ slug: "inicio" }];
}

export async function generateMetadata({ params }: PageProps<"/categorias/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const category = await getVisibleCategoryBySlug(slug);
  if (!category || category.parentId !== null) return { title: "No encontramos esta página" };
  return categoryMetadata(category, null);
}

export default async function CategoryPage({ params, searchParams }: PageProps<"/categorias/[slug]">) {
  const { slug } = await params;
  const category = await getVisibleCategoryBySlug(slug);
  if (!category) notFound();

  if (category.parentId !== null) {
    const main = (await getVisibleCategories()).find((c) => c.id === category.parentId);
    if (!main) notFound();
    permanentRedirect(categoryHref(main.slug, category.slug));
  }

  return <CategoryPageView main={category} sub={null} searchParams={searchParams} />;
}
