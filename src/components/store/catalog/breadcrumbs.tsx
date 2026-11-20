import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { siteUrl } from "@/lib/site-url";

export type Crumb = { label: string; href: string };

/**
 * Migas de pan: "Inicio › Bazar". El último paso es la página actual (sin link).
 *
 * Además van como datos estructurados (JSON-LD "BreadcrumbList"): Google
 * puede mostrar el camino en el resultado de búsqueda en lugar de la URL.
 */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  const all: Crumb[] = [{ label: "Inicio", href: "/" }, ...items];
  const base = siteUrl();

  const jsonLd = base && {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: all.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.label,
      item: `${base}${c.href}`,
    })),
  };

  return (
    <nav aria-label="Estás en">
      <ol className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
        {all.map((c, i) => {
          const isLast = i === all.length - 1;
          return (
            <li key={c.href} className="flex items-center gap-1">
              {isLast ? (
                <span aria-current="page" className="font-medium text-foreground">
                  {c.label}
                </span>
              ) : (
                <>
                  <Link href={c.href} className="rounded hover:text-foreground hover:underline hover:underline-offset-4">
                    {c.label}
                  </Link>
                  <ChevronRight aria-hidden className="size-3.5" />
                </>
              )}
            </li>
          );
        })}
      </ol>
      {jsonLd && (
        <script
          type="application/ld+json"
          // "<" escapado: un nombre de categoría nunca puede cerrar el <script>.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
        />
      )}
    </nav>
  );
}
