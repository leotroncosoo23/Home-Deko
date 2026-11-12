import { getRestockCount } from "@/app/admin/stock/data";
import { MobileNav } from "./mobile-nav";
import { SidebarNav } from "./sidebar-nav";

/**
 * La barra lateral y el menú del celular, con los contadores de cada
 * sección (por ahora: variantes para reponer en "Stock").
 *
 * Son componentes de servidor porque leen la base. El layout los pone en
 * su propio <Suspense>: mientras cargan, se ve la barra sin contadores.
 * Se actualizan solos después de cada ajuste de stock (refresh()).
 */
async function getBadges(): Promise<Record<string, number>> {
  return { "/admin/stock": await getRestockCount() };
}

export async function SidebarNavWithCounts() {
  return <SidebarNav badges={await getBadges()} />;
}

export async function MobileNavWithCounts() {
  return <MobileNav badges={await getBadges()} />;
}
