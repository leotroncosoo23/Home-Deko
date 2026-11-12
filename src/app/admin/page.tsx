import type { Metadata } from "next";
import { ComingSoon } from "@/components/admin/coming-soon";
import { PageHeader } from "@/components/admin/page-header";
import { getNavItem } from "@/components/admin/nav-items";

const section = getNavItem("/admin");

export const metadata: Metadata = { title: "Inicio" };

/**
 * /admin — página provisoria (paso 3: layout del panel).
 * Es 100 % estática, así que la navegación hacia acá es instantánea.
 * Cuando lea datos, ponerlos dentro de <Suspense> y usar requireAdmin().
 */
export default function AdminHomePage() {
  return (
    <>
      <PageHeader eyebrow={section.group} title={section.title} description={section.description} />
      <ComingSoon
        icon={section.icon}
        text="Acá vas a ver las últimas ventas, los productos con poco stock y las métricas del negocio."
      />
    </>
  );
}
