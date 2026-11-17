import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal/legal-document";
import { PRIVACIDAD } from "@/content/legales";

export const metadata: Metadata = {
  title: PRIVACIDAD.titulo,
  description: PRIVACIDAD.resumen,
};

/** /privacidad — los textos están en src/content/legales.ts */
export default function PrivacidadPage() {
  return <LegalDocument doc={PRIVACIDAD} />;
}
