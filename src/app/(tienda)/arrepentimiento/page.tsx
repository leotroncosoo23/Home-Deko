import type { Metadata } from "next";
import { InfoPage, InfoSections } from "@/components/store/info/info-page";
import { WithdrawalForm } from "@/components/store/withdrawal/withdrawal-form";
import { arrepentimiento } from "@/content/informacion";
import { datosTienda, getStoreSettings } from "@/lib/store-settings";

/**
 * BOTÓN DE ARREPENTIMIENTO (Disposición 954/2025 de la Subsecretaría de
 * Defensa del Consumidor y Lealtad Comercial):
 *   - link "a simple vista, en lugar destacado y en el primer acceso"
 *     (pie de todas las páginas, menú y encabezado de PC: WITHDRAWAL_LINK);
 *   - SIN registración previa ni trámites extra (solo nombre y email);
 *   - código de identificación de la solicitud dentro de las 24 h y por el
 *     mismo medio: se muestra al instante y además se manda por email.
 * Las solicitudes se gestionan en el panel: /admin/arrepentimientos.
 */
async function getPage() {
  return arrepentimiento(datosTienda(await getStoreSettings()));
}

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPage();
  return { title: page.titulo, description: page.descripcion };
}

export default async function ArrepentimientoPage() {
  const page = await getPage();
  return (
    <InfoPage titulo={page.titulo} intro={page.intro} href="/arrepentimiento" eyebrow="Tus derechos">
      <InfoSections secciones={page.secciones} />
      <WithdrawalForm />
    </InfoPage>
  );
}
