import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/admin/page-header";
import { getNavItem } from "@/components/admin/nav-items";
import { getCategories } from "./data";
import { CategoriesManager } from "./_components/categories-manager";
import { CategoriesSkeleton } from "./_components/categories-skeleton";
import { EmptyState } from "./_components/empty-state";
import { NewCategoryButton } from "./_components/new-category-button";

const section = getNavItem("/admin/categorias");

export const metadata: Metadata = { title: "Categorías" };

/**
 * /admin/categorias
 *
 * El encabezado (título + botón "Nueva categoría") es estático: aparece
 * al instante. El listado lee la base (con requireAdmin, dentro de
 * getCategories), así que va dentro de <Suspense> con un esqueleto.
 */
export default function CategoriesPage() {
  return (
    <>
      <PageHeader
        eyebrow={section.group}
        title={section.title}
        description={section.description}
        actions={<NewCategoryButton />}
      />
      {/* El <main> del layout ya separa los bloques (gap-6) */}
      <div>
        <Suspense fallback={<CategoriesSkeleton />}>
          <CategoriesList />
        </Suspense>
      </div>
    </>
  );
}

async function CategoriesList() {
  const categories = await getCategories();
  if (categories.length === 0) return <EmptyState />;
  return <CategoriesManager categories={categories} />;
}
