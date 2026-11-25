import Link from "next/link";

/**
 * Texto con links escritos como [texto](/ruta), igual que en
 * src/content/informacion.ts:
 *   - "/ruta" o "/ruta#ancla" → link interno de la tienda.
 *   - "https://…" → se abre en otra pestaña.
 *   - "mailto:…" → abre el programa de correo.
 * Sirve en componentes del servidor y del navegador.
 */
const LINK_RE = /\[([^\]]+)\]\(([^)\s]+)\)/g;

const linkClass = "font-medium text-brand underline underline-offset-4 hover:text-brand-hover";

export function RichText({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(LINK_RE)) {
    const [whole, label, href] = match;
    const start = match.index ?? 0;
    if (start > last) parts.push(text.slice(last, start));
    parts.push(
      href.startsWith("/") ? (
        <Link key={start} href={href} className={linkClass}>
          {label}
        </Link>
      ) : (
        <a
          key={start}
          href={href}
          className={linkClass}
          {...(href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        >
          {label}
        </a>
      ),
    );
    last = start + whole.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}
