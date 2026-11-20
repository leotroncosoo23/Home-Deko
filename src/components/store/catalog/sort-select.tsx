"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { CATALOG_SORTS, type CatalogSort } from "@/lib/catalog-params";

/**
 * Orden del catálogo. Es un <select> del navegador (en el celular abre la
 * ruedita nativa, que es la más cómoda). Al elegir, va al link de ese
 * orden: el servidor ya armó los 4 links (`hrefs`), así este componente no
 * necesita saber nada de los filtros.
 *
 * En PC se ve "Ordenar por [Destacados ▾]"; en el celular solo el selector
 * (la etiqueta sigue ahí para el lector de pantalla).
 */
export function SortSelect({ value, hrefs }: { value: CatalogSort; hrefs: Record<CatalogSort, string> }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="orden" className="sr-only text-sm whitespace-nowrap text-muted-foreground lg:not-sr-only">
        Ordenar por
      </label>
      <div className="relative">
        <select
          id="orden"
          // No controlado: muestra lo elegido al instante, y la key lo
          // reinicia cuando cambia el orden de la URL (por ejemplo, con "atrás").
          key={value}
          defaultValue={value}
          onChange={(e) => {
            const next = e.target.value as CatalogSort;
            startTransition(() => router.push(hrefs[next], { scroll: false }));
          }}
          className={cn(
            // text-base en el celular: con menos de 16 px el iPhone hace zoom al tocar
            "h-9 cursor-pointer appearance-none rounded-full border border-input bg-background pr-8 pl-3.5 text-base font-medium outline-none transition-colors hover:bg-muted/60 focus-visible:border-brand focus-visible:ring-3 focus-visible:ring-brand/15 md:text-sm",
            pending && "opacity-60",
          )}
        >
          {CATALOG_SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <ChevronDown
          aria-hidden
          className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
        />
      </div>
    </div>
  );
}
