import type { Metadata } from "next";
import { InfoPage, InfoSections } from "@/components/store/info/info-page";
import { Steps } from "@/components/store/info/steps";
import { comoComprar } from "@/content/informacion";
import { datosTienda, getStoreSettings } from "@/lib/store-settings";

/** Textos en src/content/informacion.ts; datos de Configuración (se actualizan solos). */
async function getPage() {
  return comoComprar(datosTienda(await getStoreSettings()));
}

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPage();
  return { title: page.titulo, description: page.descripcion };
}

export default async function ComoComprarPage() {
  const page = await getPage();
  return (
    <InfoPage titulo={page.titulo} intro={page.intro} href="/como-comprar">
      <Steps pasos={page.pasos} />
      <InfoSections secciones={page.secciones} />
    </InfoPage>
  );
}
