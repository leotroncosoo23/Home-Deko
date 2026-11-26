import Link from "next/link";
import { ArrowRight, Clock, MapPin } from "lucide-react";
import { SocialIcon } from "@/components/social-links";
import type { DatosTienda } from "@/lib/store-settings";

/**
 * "Estamos en Trevelin": dirección, horarios e Instagram del local, tomados
 * de Configuración. Cada línea aparece solo si el dato está cargado; si no
 * hay ninguno, el bloque no se muestra (devuelve null).
 */
export function StoreLocation({ tienda }: { tienda: Pick<DatosTienda, "direccion" | "horarios" | "instagram"> }) {
  const { direccion, horarios, instagram } = tienda;
  if (!direccion && !horarios && !instagram) return null;

  return (
    <div className="flex flex-col gap-5">
      <h2 id="local" className="font-display text-2xl leading-tight font-semibold tracking-tight md:text-3xl">
        Estamos en Trevelin
      </h2>
      <ul className="flex flex-col gap-4 text-[15px] leading-6">
        {direccion && (
          <Line icon={<MapPin aria-hidden className="size-5 text-brand" />} label="Dirección">
            {direccion}
          </Line>
        )}
        {horarios && (
          <Line icon={<Clock aria-hidden className="size-5 text-brand" />} label="Horarios">
            {/* Los horarios pueden venir en varias líneas desde Configuración */}
            <span className="whitespace-pre-line">{horarios}</span>
          </Line>
        )}
        {instagram && (
          <Line icon={<SocialIcon red="instagram" className="size-5 text-brand" />} label="Instagram">
            <a
              href={instagram.href}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
            >
              {instagram.usuario}
              <span className="sr-only"> (se abre en otra pestaña)</span>
            </a>
          </Line>
        )}
      </ul>
      {direccion && (
        <Link
          href="/contacto"
          className="inline-flex items-center gap-1 self-start rounded-md text-sm font-semibold text-brand underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/30"
        >
          Cómo llegar
          <ArrowRight aria-hidden className="size-4" />
        </Link>
      )}
    </div>
  );
}

function Line({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-background">{icon}</span>
      <div className="flex min-w-0 flex-col pt-2">
        <span className="sr-only">{label}: </span>
        <span className="break-words">{children}</span>
      </div>
    </li>
  );
}
