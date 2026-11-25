import Link from "next/link";
import { Clock, MapPin, Undo2 } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { SocialLinks } from "@/components/social-links";
import { NOMBRE_COMERCIO } from "@/content/legales";
import { formatCuit } from "@/lib/format";
import { isAlwaysPublic } from "@/lib/public-routes";
import { STORE_CONTAINER } from "@/lib/store-layout";
import { CONSUMER_DEFENSE_URL, HELP_LINKS, LEGAL_LINKS, WITHDRAWAL_LINK, type StoreLink } from "@/lib/store-nav";
import { cn } from "@/lib/utils";
import { getStoreSettings, redesSociales } from "@/lib/store-settings";

/**
 * Pie de página público: redes, ayuda, legales, el local y los datos del
 * comercio. Lo usan la tienda, "Muy pronto" y las páginas legales.
 *
 * - Google pide que los links a /privacidad y /terminos se vean en la página
 *   de inicio (LEGAL_LINKS). No quitarlos.
 * - "Botón de arrepentimiento" (Disp. 954/2025): destacado, en todas las páginas.
 * - Con la tienda SIN LANZAR, solo se muestran los links que se ven siempre
 *   (src/lib/public-routes.ts): los demás llevarían a "Muy pronto".
 * - Lo que no está cargado en Configuración simplemente no aparece (los
 *   "[COMPLETAR]" quedan solo en Términos y Privacidad, para los dueños).
 */
export async function SiteFooter() {
  const settings = await getStoreSettings();
  const redes = redesSociales(settings);
  const visible = (l: StoreLink) => settings.isLaunched || isAlwaysPublic(l.href);
  const help = HELP_LINKS.filter(visible);
  const showWithdrawal = visible(WITHDRAWAL_LINK);

  const businessName = settings.businessName.trim();
  const datos = [
    businessName && businessName !== NOMBRE_COMERCIO ? `Razón social: ${businessName}` : "",
    settings.cuit ? `CUIT: ${formatCuit(settings.cuit)}` : "",
    settings.contactEmail ? `Contacto: ${settings.contactEmail}` : "",
  ].filter(Boolean);

  return (
    <footer className="border-t bg-background">
      <div
        className={cn(
          STORE_CONTAINER,
          "grid gap-8 py-10 text-sm text-muted-foreground sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1.3fr]",
        )}
      >
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

        {/* Ayuda */}
        {help.length > 0 && <FooterLinks id="pie-ayuda" title="Ayuda" links={help} />}

        {/* Legales + Botón de arrepentimiento */}
        <FooterLinks id="pie-legales" title="Legales" links={LEGAL_LINKS}>
          {showWithdrawal && (
            <li>
              <Link
                href={WITHDRAWAL_LINK.href}
                className="inline-flex items-center gap-1.5 font-semibold text-brand underline-offset-4 hover:underline"
              >
                <Undo2 aria-hidden className="size-4" />
                {WITHDRAWAL_LINK.label}
              </Link>
            </li>
          )}
        </FooterLinks>

        {/* El local */}
        {(settings.storeAddress || settings.storeHours) && (
          <div className="flex flex-col gap-3">
            <h2 className="text-xs font-semibold tracking-[0.08em] text-foreground uppercase">El local</h2>
            {settings.storeAddress && (
              <p className="flex items-start gap-2 leading-6">
                <MapPin aria-hidden className="mt-1 size-4 shrink-0 text-brand" />
                <span>{settings.storeAddress}</span>
              </p>
            )}
            {settings.storeHours && (
              <p className="flex items-start gap-2 leading-6">
                <Clock aria-hidden className="mt-1 size-4 shrink-0 text-brand" />
                <span className="whitespace-pre-line">{settings.storeHours}</span>
              </p>
            )}
          </div>
        )}
      </div>

      {/* Datos del comercio y Defensa del Consumidor */}
      <div className="border-t">
        <div
          className={cn(
            STORE_CONTAINER,
            "flex flex-col gap-2 py-5 text-xs leading-5 text-muted-foreground lg:flex-row lg:items-center lg:justify-between lg:gap-6",
          )}
        >
          <p>
            © {NOMBRE_COMERCIO}
            {datos.map((d) => ` · ${d}`)}
          </p>
          <a
            href={CONSUMER_DEFENSE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-4 hover:text-foreground"
          >
            Defensa de las y los Consumidores. Para reclamos ingresá aquí
          </a>
        </div>
      </div>
    </footer>
  );
}

function FooterLinks({
  id,
  title,
  links,
  children,
}: {
  id: string;
  title: string;
  links: StoreLink[];
  children?: React.ReactNode;
}) {
  return (
    <nav aria-labelledby={id} className="flex flex-col gap-3">
      <h2 id={id} className="text-xs font-semibold tracking-[0.08em] text-foreground uppercase">
        {title}
      </h2>
      <ul className="flex flex-col gap-2">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="underline-offset-4 hover:text-foreground hover:underline">
              {l.label}
            </Link>
          </li>
        ))}
        {children}
      </ul>
    </nav>
  );
}
