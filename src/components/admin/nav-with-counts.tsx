import { getLabelQueueCount } from "@/app/admin/etiquetas/data";
import { getRestockCount } from "@/app/admin/stock/data";
import { MobileNav } from "./mobile-nav";
import { SidebarNav } from "./sidebar-nav";

/**
 * La barra lateral y el menú del celular, con los contadores de cada
 * sección: variantes para reponer en "Stock" y etiquetas en la cola en
 * "Etiquetas".
 *
 * Son componentes de servidor porque leen la base. El layout los pone en
 * su propio <Suspense>: mientras cargan, se ve la barra sin contadores.
 * Se actualizan solos después de cada cambio (las acciones usan refresh()).
 */
async function getBadges(): Promise<Record<string, number>> {
  const [restock, labels] = await Promise.all([getRestockCount(), getLabelQueueCount()]);
  return { "/admin/stock": restock, "/admin/etiquetas": labels };
}

export async function SidebarNavWithCounts() {
  return <SidebarNav badges={await getBadges()} />;
}

export async function MobileNavWithCounts() {
  return <MobileNav badges={await getBadges()} />;
}
