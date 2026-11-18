import Link from "next/link";
import { highlightMissing } from "@/components/legal/legal-document";
import { SocialLinks } from "@/components/social-links";
import { datosComercio, getStoreSettings, redesSociales } from "@/lib/store-settings";

/**
 * Pie de página público: redes, links a las páginas legales y datos del
 * comercio. Lo usan "Muy pronto", la tienda y las páginas legales. Google
 * pide que los links a /privacidad y /terminos se vean en la página de inicio.
 *
 * Los datos salen de la configuración del panel (cacheada: el pie sigue
 * siendo estático). Lo que falta cargar se ve como "[COMPLETAR]" resaltado.
 */
export async function SiteFooter() {
  const settings = await getStoreSettings();
  const c = datosComercio(settings);

  return (
    <footer className="border-t bg-background">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-6 text-sm text-muted-foreground">
        <SocialLinks redes={redesSociales(settings)} />
        <nav aria-label="Páginas legales" className="flex flex-wrap gap-x-4 gap-y-1">
          <Link href="/privacidad" className="underline-offset-4 hover:text-foreground hover:underline">
            Política de privacidad
          </Link>
          <Link href="/terminos" className="underline-offset-4 hover:text-foreground hover:underline">
            Términos y condiciones
          </Link>
        </nav>
        <p className="text-xs leading-5">
          {c.nombre} · {highlightMissing(c.direccion)}
          <br />
          Razón social: {highlightMissing(c.razonSocial)} · CUIT: {highlightMissing(c.cuit)}
          <br />
          Contacto: {highlightMissing(c.email)}
        </p>
      </div>
    </footer>
  );
}
