import type { Metadata } from "next";
import { ComingSoon } from "@/components/admin/coming-soon";
import { PageHeader } from "@/components/admin/page-header";
import { getNavItem } from "@/components/admin/nav-items";

const section = getNavItem("/admin/etiquetas");

export const metadata: Metadata = { title: "Etiquetas" };

/**
 * /admin/etiquetas — página provisoria (paso 3: layout del panel).
 * Es 100 % estática, así que la navegación hacia acá es instantánea.
 * Cuando lea datos, ponerlos dentro de <Suspense> y usar requireAdmin().
 */
export default function LabelsPage() {
  return (
    <>
      <PageHeader eyebrow={section.group} title={section.title} description={section.description} />
      <ComingSoon
        icon={section.icon}
        text="La cola de impresión y la vista previa del PDF A4 con los códigos de barras."
      />
    </>
  );
}
