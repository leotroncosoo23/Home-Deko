import Link from "next/link";
import { cn } from "@/lib/utils";
import { PriceFilter } from "./price-filter";

/** sub = subcategoría de la principal elegida (va indentada debajo). */
export type FilterCategory = { slug: string; name: string; href: string; active: boolean; sub?: boolean };

/**
 * Filtros del catálogo: categoría y precio. El mismo contenido va en la
 * columna izquierda (PC, 240 px) y en el panel que abre "Filtrar" (celular).
 * Todo son links o formularios GET: el estado queda en la URL.
 *
 * Diseño liviano: títulos chicos en mayúsculas, links de texto (la
 * categoría elegida en negrita con una rayita roja a la izquierda) y una
 * línea fina entre secciones.
 */
export function CatalogFilters({
  categories,
  allHref,
  allActive,
  price,
  clearHref,
  idPrefix,
}: {
  categories: FilterCategory[];
  /** "Todas las categorías". */
  allHref: string;
  allActive: boolean;
  price: { action: string; keep: Record<string, string>; min: number | null; max: number | null };
  /** Link para sacar los filtros (null si no hay ninguno puesto). */
  clearHref: string | null;
  idPrefix: string;
}) {
  return (
    <div className="flex flex-col divide-y">
      {categories.length > 0 && (
        <section aria-labelledby={`${idPrefix}-cat`} className="flex flex-col gap-3 pb-6">
          <FilterTitle id={`${idPrefix}-cat`}>Categoría</FilterTitle>
          <ul className="flex flex-col gap-0.5">
            <CategoryLink href={allHref} active={allActive}>
              Todas
            </CategoryLink>
            {categories.map((c) => (
              <CategoryLink key={c.slug} href={c.href} active={c.active} sub={c.sub}>
                {c.name}
              </CategoryLink>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby={`${idPrefix}-precio`} className="flex flex-col gap-3 py-6">
        <FilterTitle id={`${idPrefix}-precio`}>Precio</FilterTitle>
        <PriceFilter idPrefix={idPrefix} {...price} />
      </section>

      {clearHref && (
        <div className="pt-5">
          <Link
            href={clearHref}
            scroll={false}
            className="text-sm font-medium text-muted-foreground underline underline-offset-4 hover:text-brand"
          >
            Limpiar filtros
          </Link>
        </div>
      )}
    </div>
  );
}

function FilterTitle({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="text-xs font-semibold tracking-[0.08em] text-foreground uppercase">
      {children}
    </h2>
  );
}

function CategoryLink({
  href,
  active,
  sub = false,
  children,
}: {
  href: string;
  active: boolean;
  sub?: boolean;
  children: React.ReactNode;
}) {
  return (
    <li>
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className={cn(
          // 40 px de alto en el celular (fácil de tocar), 32 px en PC
          "flex min-h-10 items-center border-l-2 pl-3 text-[15px] transition-colors lg:min-h-8 lg:text-sm",
          // Subcategoría: más adentro y un poco más chica
          sub && "pl-6 text-sm lg:text-[13px]",
          active
            ? "border-brand font-semibold text-foreground"
            : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
        )}
      >
        {children}
      </Link>
    </li>
  );
}
