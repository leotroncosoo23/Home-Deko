import type { Metadata } from "next";
import { Faq } from "@/components/store/info/faq";
import { InfoPage } from "@/components/store/info/info-page";
import { RichText } from "@/components/store/info/rich-text";
import { preguntasFrecuentes } from "@/content/informacion";
import { datosTienda, getStoreSettings } from "@/lib/store-settings";

/** Textos en src/content/informacion.ts; datos de Configuración (se actualizan solos). */
async function getPage() {
  return preguntasFrecuentes(datosTienda(await getStoreSettings()));
}

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPage();
  return { title: page.titulo, description: page.descripcion };
}

export default async function PreguntasFrecuentesPage() {
  const page = await getPage();
  return (
    <InfoPage titulo={page.titulo} intro={page.intro} href="/preguntas-frecuentes">
      <Faq preguntas={page.preguntas} />
      <p className="text-center text-[15px] text-muted-foreground">
        <RichText text="¿No encontraste tu respuesta? [Escribinos](/contacto) y te ayudamos." />
      </p>
    </InfoPage>
  );
}
