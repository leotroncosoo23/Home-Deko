import type { Metadata } from "next";
import { ComingSoon } from "@/components/admin/coming-soon";
import { PageHeader } from "@/components/admin/page-header";
import { getNavItem } from "@/components/admin/nav-items";

const section = getNavItem("/admin/productos");

export const metadata: Metadata = { title: "Productos" };

/**
 * /admin/productos — página provisoria (paso 3: layout del panel).
 * Es 100 % estática, así que la navegación hacia acá es instantánea.
 * Cuando lea datos, ponerlos dentro de <Suspense> y usar requireAdmin().
 */
export default function ProductsPage() {
  return (
    <>
      <PageHeader title={section.title} description={section.description} />
      <ComingSoon
        icon={section.icon}
        text="Listado con buscador y escáner, filtros y el formulario de productos con variantes e imágenes."
      />
    </>
  );
}
