import type { Metadata } from "next";
import { Suspense } from "react";
import { parseCatalogParams } from "@/lib/catalog-params";
import { getCategoryTree, getVisibleCategories, type StoreCategory } from "@/lib/store-data";
import { categoryHref } from "@/lib/store-nav";
import { Breadcrumbs, type Crumb } from "./breadcrumbs";
import { CategoryChips } from "./category-chips";
import { CATALOG_HEADER, CATALOG_MAIN, CATALOG_TITLE, CatalogSkeleton, CatalogView } from "./catalog-view";

/**
 * Lo que comparten /categorias/[slug] (principal) y
 * /categorias/[slug]/[sub] (subcategoría): migas, título, descripción,
 * chips de subcategorías y el catálogo (filtros, orden, "Ver más").
 * La principal muestra sus productos y los de sus subcategorías.
 */

/** Descripción para Google: la que cargaron en el panel, o una armada con el nombre. */
export function categoryDescription(category: StoreCategory, main?: StoreCategory | null): string {
  const name = main ? `${category.name} (${main.name})` : category.name;
  return (
    category.description ??
    `${name} en Home Deko: artículos del hogar, bazar y blanquería. Comprá online con envío a todo el país o retiro en el local en Trevelin, Chubut.`
  ).slice(0, 300);
}

/** Título, descripción, canonical propio (URL anidada para las subcategorías) y Open Graph. */
export function categoryMetadata(category: StoreCategory, main: StoreCategory | null): Metadata {
  const description = categoryDescription(category, main);
  const title = main ? `${category.name} · ${main.name}` : category.name;
  const image = category.imageUrl ?? main?.imageUrl ?? null;
  return {
    title,
    description,
    // Una sola dirección para Google, sin importar el orden o los filtros elegidos.
    alternates: { canonical: main ? categoryHref(main.slug, category.slug) : categoryHref(category.slug) },
    openGraph: {
      title: `${title} · Home Deko`,
      description,
      ...(image ? { images: [{ url: image }] } : {}),
    },
  };
}

export async function CategoryPageView({
  main,
  sub,
  searchParams,
}: {
  main: StoreCategory;
  /** null = página de la principal. */
  sub: StoreCategory | null;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const current = sub ?? main;
  const tree = await getCategoryTree();
  const subs = tree.find((m) => m.id === main.id)?.children ?? [];
  const crumbs: Crumb[] = [{ label: main.name, href: categoryHref(main.slug) }];
  if (sub) crumbs.push({ label: sub.name, href: categoryHref(main.slug, sub.slug) });

  return (
    <main className={CATALOG_MAIN}>
      <header className="flex flex-col gap-4">
        <div className={CATALOG_HEADER}>
          <Breadcrumbs items={crumbs} />
          <h1 className={CATALOG_TITLE}>{current.name}</h1>
          {current.description && (
            <p className="max-w-2xl text-[15px] leading-6 text-muted-foreground">{current.description}</p>
          )}
        </div>
        <CategoryChips main={main} subs={subs} activeSlug={sub?.slug ?? null} />
      </header>
      {/* Lee la URL (filtros) y la sesión (borradores para admins) */}
      <Suspense fallback={<CatalogSkeleton />}>
        <CategoryProducts category={current} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function CategoryProducts({
  category,
  searchParams,
}: {
  category: StoreCategory;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [sp, categories] = await Promise.all([searchParams, getVisibleCategories()]);
  return <CatalogView scope={{ kind: "category", category }} params={parseCatalogParams(sp)} categories={categories} />;
}
