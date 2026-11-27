import type { Metadata } from "next";
import { Suspense } from "react";
import { HelpSheet } from "@/components/admin/help-sheet";
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
 * El encabezado (título + botón "Nueva categoría") aparece al instante;
 * el botón se habilita apenas llegan las categorías (para "Pertenece a"). El listado lee la base (con requireAdmin, dentro de
 * getCategories), así que va dentro de <Suspense> con un esqueleto.
 */
export default function CategoriesPage() {
  return (
    <>
      <PageHeader
        eyebrow={section.group}
        title={section.title}
        description={section.description}
        actions={
          <>
            <HelpSheet guia="categorias" />
            {/* Lee las categorías (para "Pertenece a"): mientras tanto, el botón deshabilitado */}
            <Suspense fallback={<NewCategoryButton categories={[]} disabled />}>
              <NewCategoryButtonWithData />
            </Suspense>
          </>
        }
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

/** getCategories() está en cache(): el encabezado y el listado la leen una sola vez. */
async function NewCategoryButtonWithData() {
  return <NewCategoryButton categories={await getCategories()} />;
}

async function CategoriesList() {
  const categories = await getCategories();
  if (categories.length === 0) return <EmptyState />;
  return <CategoriesManager categories={categories} />;
}
