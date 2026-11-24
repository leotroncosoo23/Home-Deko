import { getLabelQueueCount } from "@/app/admin/(panel)/etiquetas/data";
import { getOrdersAttentionCount } from "@/app/admin/(panel)/pedidos/data";
import { getRestockCount } from "@/app/admin/(panel)/stock/data";
import { getPanelAccess } from "@/lib/auth";
import { MobileNav } from "./mobile-nav";
import type { NavAccess } from "./nav-items";
import { SidebarNav } from "./sidebar-nav";

/**
 * La barra lateral y el menú del celular, con:
 *   - los contadores de cada sección: pedidos que requieren atención en
 *     "Pedidos", variantes para reponer en "Stock" y etiquetas en la cola en
 *     "Etiquetas";
 *   - los permisos de las secciones reservadas (hoy: Apariencia de la tienda, solo para el
 *     desarrollador). Ocultarlas del menú es solo comodidad: la seguridad
 *     está en requireAppearanceAccess() y en el RLS.
 *
 * Son componentes de servidor porque leen la base. El layout los pone en
 * su propio <Suspense>: mientras cargan, se ve la barra sin contadores y sin
 * las secciones reservadas. Se actualizan solos después de cada cambio
 * (las acciones usan refresh()).
 */
async function getNavData(): Promise<{ badges: Record<string, number>; access: NavAccess }> {
  const [orders, restock, labels, access] = await Promise.all([
    getOrdersAttentionCount(),
    getRestockCount(),
    getLabelQueueCount(),
    getPanelAccess(),
  ]);
  return {
    badges: { "/admin/pedidos": orders, "/admin/stock": restock, "/admin/etiquetas": labels },
    access,
  };
}

export async function SidebarNavWithCounts() {
  const { badges, access } = await getNavData();
  return <SidebarNav badges={badges} access={access} />;
}

export async function MobileNavWithCounts() {
  const { badges, access } = await getNavData();
  return <MobileNav badges={badges} access={access} />;
}
