import Link from "next/link";
import { Clock, MapPin } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { highlightMissing } from "@/components/legal/legal-document";
import { SocialLinks } from "@/components/social-links";
import { STORE_CONTAINER } from "@/lib/store-layout";
import { INFO_LINKS } from "@/lib/store-nav";
import { cn } from "@/lib/utils";
import { datosComercio, getStoreSettings, redesSociales } from "@/lib/store-settings";

/**
 * Pie de página público: redes, información, el local y los datos del
 * comercio. Lo usan la tienda, "Muy pronto" y las páginas legales.
 *
 * Google pide que los links a /privacidad y /terminos se vean en la página
 * de inicio: están en INFO_LINKS (src/lib/store-nav.ts). No quitarlos.
 *
 * Los datos salen de la configuración del panel (cacheada: el pie sigue
 * siendo estático). Lo que falta cargar se ve como "[COMPLETAR]" resaltado.
 */
export async function SiteFooter() {
  const settings = await getStoreSettings();
  const c = datosComercio(settings);
  const redes = redesSociales(settings);

  return (
    <footer className="border-t bg-background">
      <div className={cn(STORE_CONTAINER, "grid gap-8 py-10 text-sm text-muted-foreground sm:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1.3fr]")}>
        {/* Marca y redes */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            {/* Logo sin la frase + la frase como texto: a este tamaño se lee bien */}
            <Logo variant="wordmark" decorative className="h-9 w-auto self-start" />
            <p className="text-[11px] font-medium tracking-[0.3em] text-foreground uppercase">Artículos del hogar</p>
          </div>
          <p className="max-w-xs leading-6">Tu casa, tu refugio, con diseño y calidez.</p>
          <SocialLinks redes={redes} />
        </div>

        {/* Información */}
        <nav aria-labelledby="pie-informacion" className="flex flex-col gap-3">
          <h2 id="pie-informacion" className="text-xs font-semibold tracking-[0.08em] text-foreground uppercase">
            Información
          </h2>
          <ul className="flex flex-col gap-2">
            {INFO_LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="underline-offset-4 hover:text-foreground hover:underline">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* El local */}
        <div className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold tracking-[0.08em] text-foreground uppercase">El local</h2>
          <p className="flex items-start gap-2 leading-6">
            <MapPin aria-hidden className="mt-1 size-4 shrink-0 text-brand" />
            <span>{highlightMissing(c.direccion)}</span>
          </p>
          {settings.storeHours && (
            <p className="flex items-start gap-2 leading-6">
              <Clock aria-hidden className="mt-1 size-4 shrink-0 text-brand" />
              <span className="whitespace-pre-line">{settings.storeHours}</span>
            </p>
          )}
        </div>
      </div>

      {/* Datos del comercio */}
      <div className="border-t">
        <p className={cn(STORE_CONTAINER, "py-5 text-xs leading-5 text-muted-foreground")}>
          © {c.nombre} · Razón social: {highlightMissing(c.razonSocial)} · CUIT:{" "}
          {highlightMissing(c.cuit)} · Contacto: {highlightMissing(c.email)}
        </p>
      </div>
    </footer>
  );
}
