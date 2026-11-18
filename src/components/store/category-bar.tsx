"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { cn } from "cn";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { StoreCategory } from "@/lib/store-data";
import { ALL_PRODUCTS_LINK, categoryHref } from "@/lib/store-nav";

/** Espacio entre links (px). Igual que la clase gap-1 de abajo. */
const GAP = 4;

/**
 * Barra de categorías del encabezado de ESCRITORIO (desde 1024 px), en el
 * orden de Categorías del panel.
 *
 * Si no entran todas en una línea, muestra las que entran y suma
 * "Todas las categorías ▾" con la lista completa. Para saber cuántas
 * entran, mide los links en una fila invisible y vuelve a calcular cuando
 * cambia el ancho de la ventana.
 */
export function CategoryBar({ categories }: { categories: StoreCategory[] }) {
  // usePathname (para marcar la categoría actual): en las rutas dinámicas la
  // URL exacta recién se conoce al pedir la página, por eso va en <Suspense>.
  // Mientras tanto, la misma barra sin marcar ninguna (dura un instante).
  return (
    <Suspense fallback={<Bar categories={categories} pathname={null} />}>
      <BarWithPathname categories={categories} />
    </Suspense>
  );
}

function BarWithPathname({ categories }: { categories: StoreCategory[] }) {
  return <Bar categories={categories} pathname={usePathname()} />;
}

function Bar({ categories, pathname }: { categories: StoreCategory[]; pathname: string | null }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLButtonElement>(null);
  // Cuántas categorías se ven en la barra (null = todavía no se midió).
  const [visible, setVisible] = useState<number | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    const measure = measureRef.current;
    if (!container || !measure) return;

    function update() {
      const available = container!.clientWidth;
      // Fila invisible: [Todos los productos, cat1, cat2, …] y el botón "Todas…"
      const widths = Array.from(measure!.children, (el) => (el as HTMLElement).offsetWidth + GAP);
      const [allProducts, ...cats] = widths;
      const total = allProducts + cats.reduce((a, b) => a + b, 0);
      if (total <= available) {
        setVisible(cats.length);
        return;
      }
      const moreWidth = (moreRef.current?.offsetWidth ?? 180) + GAP;
      let used = allProducts + moreWidth;
      let count = 0;
      for (const w of cats) {
        if (used + w > available) break;
        used += w;
        count++;
      }
      setVisible(count);
    }

    const observer = new ResizeObserver(update);
    observer.observe(container);
    return () => observer.disconnect();
  }, [categories]);

  const shown = visible ?? categories.length;
  const overflow = shown < categories.length;

  return (
    <nav aria-label="Categorías" className="border-t">
      <div className="mx-auto flex h-12 w-full max-w-6xl items-center px-6">
      <div ref={containerRef} className="relative flex min-w-0 flex-1 items-center">
        {/* Fila para medir (invisible, no se puede tocar ni la lee el lector de pantalla) */}
        <div ref={measureRef} aria-hidden inert className="pointer-events-none invisible absolute flex whitespace-nowrap">
          <BarLink href={ALL_PRODUCTS_LINK.href} label={ALL_PRODUCTS_LINK.label} active={false} />
          {categories.map((c) => (
            <BarLink key={c.id} href={categoryHref(c.slug)} label={c.name} active={false} />
          ))}
        </div>

        <ul className={cn("flex min-w-0 items-center gap-1 overflow-hidden whitespace-nowrap", visible === null && "invisible")}>
          <li>
            <BarLink href={ALL_PRODUCTS_LINK.href} label={ALL_PRODUCTS_LINK.label} active={pathname === ALL_PRODUCTS_LINK.href} />
          </li>
          {categories.slice(0, shown).map((c) => (
            <li key={c.id}>
              <BarLink href={categoryHref(c.slug)} label={c.name} active={pathname === categoryHref(c.slug)} />
            </li>
          ))}
        </ul>

        {/* "Todas las categorías": solo si no entran todas. Se renderiza siempre
            (invisible) para poder medir su ancho. */}
        <DropdownMenu>
          <DropdownMenuTrigger
            ref={moreRef}
            className={cn(
              "ml-1 inline-flex h-9 shrink-0 items-center gap-1 rounded-full px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/20 focus-visible:outline-none",
              !overflow && "pointer-events-none invisible",
            )}
            tabIndex={overflow ? undefined : -1}
            aria-hidden={overflow ? undefined : true}
          >
            Todas las categorías
            <ChevronDown aria-hidden className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64 p-1.5">
            <DropdownMenuItem render={<Link href={ALL_PRODUCTS_LINK.href} />} className="h-9 font-medium">
              {ALL_PRODUCTS_LINK.label}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {categories.map((c) => (
              <DropdownMenuItem key={c.id} render={<Link href={categoryHref(c.slug)} />} className="gap-3 py-1.5">
                <span className="relative size-8 shrink-0 overflow-hidden rounded-md bg-muted">
                  {c.imageUrl && <Image src={c.imageUrl} alt="" fill sizes="32px" className="object-cover" />}
                </span>
                {c.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      </div>
    </nav>
  );
}

function BarLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative inline-flex h-9 items-center rounded-full px-3 text-sm font-medium transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/20 focus-visible:outline-none",
        active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
      {/* Categoría actual: subrayado rojo fino */}
      {active && <span aria-hidden className="absolute inset-x-3 -bottom-0.5 h-0.5 rounded-full bg-brand" />}
    </Link>
  );
}
