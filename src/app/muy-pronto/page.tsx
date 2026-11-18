import type { Metadata } from "next";
import { MapPin } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { SiteFooter } from "@/components/site-footer";
import { SocialLinks } from "@/components/social-links";
import { StoreHighlights } from "@/components/store/store-highlights";
import { WhatsAppButton } from "@/components/store/whatsapp-button";
import { highlightMissing } from "@/components/legal/legal-document";
import { datosComercio, getStoreSettings, redesSociales } from "@/lib/store-settings";

const DESCRIPTION =
  "Tienda online de Home Deko: artículos del hogar, bazar y blanquería, con local en Trevelin, Chubut. Comprá con Mercado Pago, con envío a domicilio o retiro en el local.";

export const metadata: Metadata = {
  // "absolute": sin la plantilla "%s · Home Deko". Google verifica que el
  // nombre de la app ("Home Deko") sea el título de la página de inicio.
  title: { absolute: "Home Deko" },
  description: DESCRIPTION,
  openGraph: { title: "Home Deko", description: DESCRIPTION },
};

/**
 * Página "Muy pronto": lo que ven los visitantes mientras la tienda no está
 * lanzada (interruptor en el panel: Configuración).
 *
 * Nadie entra a /muy-pronto directamente: el proxy (src/proxy.ts) MUESTRA
 * esta página en "/" (y en cualquier ruta de la tienda) sin cambiar la URL.
 * Si alguien escribe /muy-pronto, el proxy lo manda a "/".
 *
 * Google la revisa en "/" para verificar la marca del inicio de sesión con
 * Google. NO quitar: título y <h1> "Home Deko", qué es el sitio, cómo se
 * compra, para qué sirve la cuenta y los links a /privacidad y /terminos
 * (en el pie). Es estática: los datos del panel llegan cacheados.
 */
export default async function ComingSoonPage() {
  const settings = await getStoreSettings();
  const c = datosComercio(settings);
  const redes = redesSociales(settings);

  return (
    <div className="flex flex-1 flex-col bg-surface">
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-10 sm:py-16">
        <header className="flex flex-col items-center gap-4 text-center">
          <Logo variant="stacked" preload decorative className="h-auto w-40 sm:w-50" />
          <span className="rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold tracking-[0.08em] text-brand uppercase">
            Muy pronto
          </span>
          <h1 className="font-display text-4xl leading-tight font-semibold tracking-tight sm:text-5xl">
            Home Deko
          </h1>
          <p className="max-w-lg text-[17px] leading-7 text-muted-foreground">
            Artículos del hogar, bazar y blanquería en Trevelin, Chubut.
            <br className="hidden sm:block" /> Estamos preparando nuestra tienda online.
          </p>
        </header>

        <section aria-labelledby="que-es" className="surface-card flex flex-col gap-5 p-5 sm:p-8">
          <h2 id="que-es" className="text-lg font-semibold tracking-tight">
            Qué vas a encontrar en este sitio
          </h2>
          <StoreHighlights comercio={c} upcoming />
        </section>

        {redes.length > 0 && (
          <section aria-labelledby="redes" className="flex flex-col items-center gap-3 text-center">
            <h2 id="redes" className="text-sm font-semibold">
              Seguinos para enterarte del lanzamiento
            </h2>
            <SocialLinks redes={redes} className="justify-center" />
          </section>
        )}

        <p className="flex items-start justify-center gap-2 text-center text-sm text-muted-foreground">
          <MapPin aria-hidden className="mt-0.5 size-4 shrink-0 text-brand" />
          <span>
            Mientras tanto, te esperamos en el local: {highlightMissing(c.direccion)}.
          </span>
        </p>
      </main>

      <SiteFooter />
      <WhatsAppButton />
    </div>
  );
}
