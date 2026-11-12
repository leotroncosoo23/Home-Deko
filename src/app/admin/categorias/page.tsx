import type { Metadata } from "next";
import { ComingSoon } from "@/components/admin/coming-soon";
import { PageHeader } from "@/components/admin/page-header";
import { getNavItem } from "@/components/admin/nav-items";

const section = getNavItem("/admin/categorias");

export const metadata: Metadata = { title: "Categorías" };

/**
 * /admin/categorias — página provisoria (paso 3: layout del panel).
 * Es 100 % estática, así que la navegación hacia acá es instantánea.
 * Cuando lea datos, ponerlos dentro de <Suspense> y usar requireAdmin().
 */
export default function CategoriesPage() {
  return (
    <>
      <PageHeader title={section.title} description={section.description} />
      <ComingSoon
        icon={section.icon}
        text="Alta, edición, baja y orden de las categorías de la tienda."
      />
    </>
  );
}
