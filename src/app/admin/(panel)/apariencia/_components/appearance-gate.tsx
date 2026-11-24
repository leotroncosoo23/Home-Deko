import { requireAppearanceAccess } from "@/lib/auth";

/**
 * Envuelve TODO el contenido de las páginas de "Apariencia de la tienda" (también el
 * encabezado): si el usuario no tiene permiso, la página responde
 * "No encontramos esta página" (notFound) sin mostrar nada de la sección.
 * Hoy la sección es solo para el desarrollador (can_manage_appearance() en la base).
 *
 * Lee la sesión → va dentro de <Suspense>.
 */
export async function AppearanceGate({ children }: { children: React.ReactNode }) {
  await requireAppearanceAccess();
  return <>{children}</>;
}
