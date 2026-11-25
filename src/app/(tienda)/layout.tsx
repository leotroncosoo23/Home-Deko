import type { Metadata } from "next";
import { StoreFrame } from "@/components/store/store-frame";
import { VisitTracker } from "@/components/store/visit-tracker";
import { getStoreSettings } from "@/lib/store-settings";

/**
 * Marco de la TIENDA (grupo de rutas "(tienda)": no aparece en la URL).
 * La estructura (barra de admin, encabezado, pie y WhatsApp) está en
 * src/components/store/store-frame.tsx.
 *
 * Modo construcción: mientras la tienda no está lanzada, el proxy
 * (src/proxy.ts) le muestra "Muy pronto" a los visitantes y deja pasar
 * solo a los admins.
 */
export async function generateMetadata(): Promise<Metadata> {
  const { isLaunched } = await getStoreSettings();
  // Sin lanzar: que los buscadores no indexen la tienda en construcción.
  return isLaunched ? {} : { robots: { index: false, follow: false } };
}

export default function TiendaLayout({ children }: LayoutProps<"/">) {
  return (
    <StoreFrame>
      {children}
      {/* Contador anónimo de visitas (sin cookies): ver visit-tracker.tsx */}
      <VisitTracker />
    </StoreFrame>
  );
}
