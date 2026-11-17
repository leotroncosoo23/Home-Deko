import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal/legal-document";
import { TERMINOS } from "@/content/legales";

export const metadata: Metadata = {
  title: TERMINOS.titulo,
  description: TERMINOS.resumen,
};

/** /terminos — los textos están en src/content/legales.ts */
export default function TerminosPage() {
  return <LegalDocument doc={TERMINOS} />;
}
