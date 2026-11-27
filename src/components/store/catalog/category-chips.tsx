import Link from "next/link";
import { cn } from "@/lib/utils";
import { categoryHref } from "@/lib/store-nav";

/**
 * Chips de subcategorías de una categoría principal: "Todo", "Utensilios",
 * "Vajilla"… Se deslizan de costado en el celular (sin barra visible) y el
 * activo va en el color de la marca. Solo aparecen si la principal tiene
 * subcategorías con productos.
 */
export function CategoryChips({
  main,
  subs,
  activeSlug,
}: {
  main: { name: string; slug: string };
  subs: { id: string; name: string; slug: string }[];
  /** null = "Todo" (la principal). */
  activeSlug: string | null;
}) {
  if (subs.length === 0) return null;
  const chips = [
    { key: "todo", label: "Todo", href: categoryHref(main.slug), active: activeSlug === null },
    ...subs.map((s) => ({
      key: s.id,
      label: s.name,
      href: categoryHref(main.slug, s.slug),
      active: activeSlug === s.slug,
    })),
  ];

  return (
    <nav aria-label={`Subcategorías de ${main.name}`} className="-mx-4 sm:-mx-6 lg:mx-0">
      <ul className="scrollbar-none flex snap-x gap-2 overflow-x-auto px-4 py-0.5 sm:px-6 lg:flex-wrap lg:overflow-visible lg:px-0">
        {chips.map((c) => (
          <li key={c.key} className="shrink-0 snap-start">
            <Link
              href={c.href}
              aria-current={c.active ? "page" : undefined}
              className={cn(
                "inline-flex h-10 items-center rounded-full border px-4 text-sm whitespace-nowrap transition-colors focus-visible:ring-3 focus-visible:ring-ring/30 focus-visible:outline-none",
                c.active
                  ? "border-brand bg-brand font-semibold text-white"
                  : "border-border bg-background text-foreground hover:border-foreground/40",
              )}
            >
              {c.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
