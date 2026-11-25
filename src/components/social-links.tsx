import { MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RedSocial } from "@/lib/store-settings";

/**
 * Links a Instagram, TikTok y WhatsApp (solo los que están cargados en
 * Configuración). Los usan la página "Muy pronto" y el pie de página.
 *
 * Los íconos de Instagram y TikTok están dibujados acá (lucide ya no
 * incluye logos de marcas), con el mismo trazo que el resto de los íconos.
 */
export function SocialLinks({ redes, className }: { redes: RedSocial[]; className?: string }) {
  if (redes.length === 0) return null;
  return (
    <ul className={cn("flex flex-wrap items-center gap-2", className)}>
      {redes.map((r) => (
        <li key={r.red}>
          <a
            href={r.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${r.label} de Home Deko (se abre en otra pestaña)`}
            className="inline-flex h-9 items-center gap-2 rounded-full border bg-background px-3 text-sm font-medium text-foreground transition-colors hover:border-brand/40 hover:text-brand focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
          >
            <SocialIcon red={r.red} />
            {r.label}
          </a>
        </li>
      ))}
    </ul>
  );
}

/** Ícono de cada red (también lo usa la página de Contacto). */
export function SocialIcon({ red, className = "size-4" }: { red: RedSocial["red"]; className?: string }) {
  if (red === "whatsapp") return <MessageCircle aria-hidden className={className} />;
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {red === "instagram" ? (
        <>
          <rect x="2" y="2" width="20" height="20" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" />
        </>
      ) : (
        <path d="M9 12a4 4 0 1 0 4 4V2a5 5 0 0 0 5 5" />
      )}
    </svg>
  );
}
