import type { Metadata } from "next";
import { InfoPage, InfoSections } from "@/components/store/info/info-page";
import { cambios } from "@/content/informacion";
import { datosTienda, getStoreSettings } from "@/lib/store-settings";

/** Textos en src/content/informacion.ts; los días de cambio salen de Configuración. */
async function getPage() {
  return cambios(datosTienda(await getStoreSettings()));
}

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPage();
  return { title: page.titulo, description: page.descripcion };
}

export default async function CambiosPage() {
  const page = await getPage();
  return (
    <InfoPage titulo={page.titulo} intro={page.intro} href="/cambios-y-devoluciones">
      <InfoSections secciones={page.secciones} />
    </InfoPage>
  );
}
