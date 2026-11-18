import type { Metadata } from "next";
import { SiteFooter } from "@/components/site-footer";
import { getStoreSettings } from "@/lib/store-settings";
import { PreviewBar } from "./_components/preview-bar";

/**
 * Marco de la TIENDA (grupo de rutas "(tienda)": no aparece en la URL).
 *
 * Modo construcción: mientras la tienda no está lanzada, el proxy
 * (src/proxy.ts) le muestra "Muy pronto" a los visitantes y deja pasar
 * solo a los admins, que ven esto con la barra de vista previa arriba.
 */
export async function generateMetadata(): Promise<Metadata> {
  const { isLaunched } = await getStoreSettings();
  // Sin lanzar: que los buscadores no indexen la tienda en construcción.
  return isLaunched ? {} : { robots: { index: false, follow: false } };
}

export default function TiendaLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex flex-1 flex-col bg-background">
      <PreviewBar />
      <div className="flex flex-1 flex-col">{children}</div>
      <SiteFooter />
    </div>
  );
}
