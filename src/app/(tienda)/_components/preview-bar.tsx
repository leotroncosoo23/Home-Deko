import Link from "next/link";
import { Eye } from "lucide-react";
import { getStoreSettings } from "@/lib/store-settings";

/**
 * Barra fina arriba de la tienda mientras NO está lanzada.
 *
 * No hace falta leer la sesión para saber si mostrarla: con la tienda sin
 * lanzar, el proxy (src/proxy.ts) solo deja ver la tienda a los admins
 * (al resto les muestra "Muy pronto"). Así esta barra sale del dato
 * cacheado y la tienda sigue siendo estática.
 */
export async function PreviewBar() {
  const { isLaunched } = await getStoreSettings();
  if (isLaunched) return null;

  return (
    <div className="bg-primary text-primary-foreground">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-center gap-x-3 gap-y-1 px-4 py-1.5 text-center text-xs sm:text-sm flex-wrap">
        <span className="inline-flex items-center gap-1.5">
          <Eye aria-hidden className="size-3.5 shrink-0" />
          Vista previa: la tienda todavía no está publicada
        </span>
        <Link
          href="/admin/configuracion"
          className="font-semibold underline underline-offset-4 hover:opacity-80"
        >
          Configuración
        </Link>
      </div>
    </div>
  );
}
