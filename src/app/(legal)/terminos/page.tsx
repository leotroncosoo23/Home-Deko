import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal/legal-document";
import { terminos } from "@/content/legales";
import { datosComercio, getStoreSettings } from "@/lib/store-settings";

/** Arma el documento con los datos del comercio cargados en el panel (cacheados). */
async function getDoc() {
  return terminos(datosComercio(await getStoreSettings()));
}

export async function generateMetadata(): Promise<Metadata> {
  const doc = await getDoc();
  return { title: doc.titulo, description: doc.resumen };
}

/** /terminos — los textos están en src/content/legales.ts */
export default async function TerminosPage() {
  return <LegalDocument doc={await getDoc()} />;
}
