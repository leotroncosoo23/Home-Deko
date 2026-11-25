import type { Metadata } from "next";
import { InfoPage, InfoSections } from "@/components/store/info/info-page";
import { envios } from "@/content/informacion";
import { datosTienda, getStoreSettings } from "@/lib/store-settings";

/** Textos en src/content/informacion.ts; costo, plazo, dirección y horarios de Configuración. */
async function getPage() {
  return envios(datosTienda(await getStoreSettings()));
}

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPage();
  return { title: page.titulo, description: page.descripcion };
}

export default async function EnviosPage() {
  const page = await getPage();
  return (
    <InfoPage titulo={page.titulo} intro={page.intro} href="/envios">
      <InfoSections secciones={page.secciones} />
    </InfoPage>
  );
}
