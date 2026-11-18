import Link from "next/link";
import { Eye, UserRound } from "lucide-react";
import { getStoreSettings } from "@/lib/store-settings";
import { getStoreViewer } from "@/lib/store-viewer";
import { CustomerViewToggle } from "./customer-view-toggle";

/**
 * Barra fina arriba de la tienda, SOLO para los dueños (sesión de admin).
 * Los visitantes nunca la ven.
 *
 *   - Tienda sin lanzar: avisa que es una vista previa.
 *   - Siempre: botón "Ver como cliente" (oculta los borradores y los avisos
 *     para dueños: la tienda se ve igual que para un visitante) y "Volver a
 *     la vista de admin".
 *
 * Lee la sesión → va dentro de <Suspense> en el layout (el resto de la
 * tienda sigue siendo estático).
 */
export async function AdminBar() {
  const [viewer, { isLaunched }] = await Promise.all([getStoreViewer(), getStoreSettings()]);
  if (!viewer.isAdmin) return null;

  let message: React.ReactNode;
  if (viewer.customerView) {
    message = (
      <>
        <UserRound aria-hidden className="size-3.5 shrink-0" />
        Estás viendo la tienda como un cliente
        {!isLaunched && <span className="opacity-80">· Así la van a ver cuando la lancen</span>}
      </>
    );
  } else if (!isLaunched) {
    message = (
      <>
        <Eye aria-hidden className="size-3.5 shrink-0" />
        Vista previa: la tienda todavía no está publicada
      </>
    );
  } else {
    message = (
      <>
        <Eye aria-hidden className="size-3.5 shrink-0" />
        Estás viendo la tienda con tu sesión de admin
      </>
    );
  }

  return (
    <div className="bg-primary text-primary-foreground">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-center gap-x-4 gap-y-1 px-4 py-1.5 text-center text-xs sm:text-sm">
        <span className="inline-flex flex-wrap items-center justify-center gap-x-1.5">{message}</span>
        <span className="inline-flex items-center gap-4">
          <CustomerViewToggle customerView={viewer.customerView} />
          {!isLaunched && !viewer.customerView && (
            <Link href="/admin/configuracion" className="font-semibold underline underline-offset-4 hover:opacity-80">
              Configuración
            </Link>
          )}
        </span>
      </div>
    </div>
  );
}
