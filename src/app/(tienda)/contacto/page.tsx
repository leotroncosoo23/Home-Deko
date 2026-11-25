import type { Metadata } from "next";
import { Clock, ExternalLink, Mail, MapPin } from "lucide-react";
import { SocialIcon } from "@/components/social-links";
import { InfoPage } from "@/components/store/info/info-page";
import { MapEmbed } from "@/components/store/info/map-embed";
import { RichText } from "@/components/store/info/rich-text";
import { contacto } from "@/content/informacion";
import type { RedSocial } from "@/lib/store-settings";
import { datosTienda, getStoreSettings } from "@/lib/store-settings";

/**
 * Contacto: WhatsApp, email, Instagram, TikTok y el local (dirección,
 * horarios y mapa). Todo sale de Configuración: lo que no está cargado no
 * aparece. Textos en src/content/informacion.ts.
 */
async function getData() {
  const D = datosTienda(await getStoreSettings());
  return { D, page: contacto(D) };
}

export async function generateMetadata(): Promise<Metadata> {
  const { page } = await getData();
  return { title: page.titulo, description: page.descripcion };
}

export default async function ContactoPage() {
  const { D, page } = await getData();

  const canales: { key: string; icon: React.ReactNode; titulo: string; detalle: string; texto: string; href: string }[] = [];
  if (D.whatsapp) {
    canales.push({
      key: "whatsapp",
      icon: <SocialIcon red="whatsapp" className="size-5" />,
      titulo: "WhatsApp",
      detalle: D.whatsapp.numero,
      texto: page.whatsappTexto,
      href: D.whatsapp.href,
    });
  }
  if (D.email) {
    canales.push({
      key: "email",
      icon: <Mail aria-hidden className="size-5" />,
      titulo: "Email",
      detalle: D.email,
      texto: page.emailTexto,
      href: `mailto:${D.email}`,
    });
  }
  const redes: [RedSocial["red"], string, { usuario: string; href: string } | null][] = [
    ["instagram", "Instagram", D.instagram],
    ["tiktok", "TikTok", D.tiktok],
  ];
  for (const [red, titulo, datos] of redes) {
    if (!datos) continue;
    canales.push({
      key: red,
      icon: <SocialIcon red={red} className="size-5" />,
      titulo,
      detalle: datos.usuario,
      texto: page.redesTexto,
      href: datos.href,
    });
  }

  return (
    <InfoPage titulo={page.titulo} intro={page.intro} href="/contacto">
      {canales.length > 0 && (
        <ul className="grid gap-4 sm:grid-cols-2">
          {canales.map((c) => (
            <li key={c.key}>
              <a
                href={c.href}
                {...(c.href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                className="surface-card group flex h-full items-start gap-4 p-5 transition-colors hover:border-brand/40 focus-visible:ring-3 focus-visible:ring-ring/20 focus-visible:outline-none"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
                  {c.icon}
                </span>
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="flex items-center gap-1.5 font-semibold">
                    {c.titulo}
                    {c.href.startsWith("http") && (
                      <>
                        <ExternalLink aria-hidden className="size-3.5 text-muted-foreground" />
                        <span className="sr-only">(se abre en otra pestaña)</span>
                      </>
                    )}
                  </span>
                  <span className="truncate font-medium text-brand group-hover:underline group-hover:underline-offset-4">
                    {c.detalle}
                  </span>
                  <span className="text-sm text-muted-foreground">{c.texto}</span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}

      {(D.direccion || D.horarios) && (
        <section id="local" aria-labelledby="local-titulo" className="surface-card flex scroll-mt-28 flex-col gap-5 p-5 sm:p-7">
          <h2 id="local-titulo" className="text-lg font-semibold tracking-tight">
            {page.localTitulo}
          </h2>
          <div className="flex flex-col gap-3 text-[15px] leading-7">
            {D.direccion && (
              <p className="flex items-start gap-3">
                <MapPin aria-hidden className="mt-1 size-5 shrink-0 text-brand" />
                <span>
                  {D.direccion}
                  <br />
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(D.direccion)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-brand underline underline-offset-4 hover:text-brand-hover"
                  >
                    Cómo llegar
                  </a>
                </span>
              </p>
            )}
            {D.horarios && (
              <p className="flex items-start gap-3">
                <Clock aria-hidden className="mt-1 size-5 shrink-0 text-brand" />
                <span className="whitespace-pre-line">{D.horarios}</span>
              </p>
            )}
          </div>
          {D.direccion && <MapEmbed address={D.direccion} />}
        </section>
      )}

      <p className="text-center text-[15px] text-muted-foreground">
        <RichText text="¿Tenés una duda rápida? Mirá las [preguntas frecuentes](/preguntas-frecuentes)." />
      </p>
    </InfoPage>
  );
}
