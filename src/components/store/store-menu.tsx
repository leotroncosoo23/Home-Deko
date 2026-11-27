"use client";

import { useId, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronDown, ChevronRight, LayoutGrid, Menu, Undo2 } from "lucide-react";
import { cn } from "cn";
import { Logo } from "@/components/brand/logo";
import { SocialLinks } from "@/components/social-links";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { StoreCategoryNode } from "@/lib/store-data";
import { ALL_PRODUCTS_LINK, categoryHref, HELP_LINKS, LEGAL_LINKS, WITHDRAWAL_LINK } from "@/lib/store-nav";
import type { RedSocial } from "@/lib/store-settings";

/**
 * Menú hamburguesa de la tienda (panel que entra desde la izquierda):
 * todos los productos, categorías con su foto (las que tienen subcategorías
 * abren un acordeón con sus subcategorías y "Ver todo"), ayuda (con el Botón de
 * arrepentimiento destacado), legales y redes.
 * Se cierra solo al tocar un link.
 */
export function StoreMenu({
  categories,
  redes,
  account,
}: {
  /** Principales con sus subcategorías (getCategoryTree). */
  categories: StoreCategoryNode[];
  redes: RedSocial[];
  /** "Mi cuenta" o "Panel" (lo arma el servidor, que lee la sesión). */
  account: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        aria-label="Abrir el menú"
        className="-ml-2 inline-flex size-10 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/20 focus-visible:outline-none"
      >
        <Menu className="size-[22px]" aria-hidden />
      </SheetTrigger>

      <SheetContent side="left" className="w-[85%] gap-0 overflow-y-auto p-0 sm:max-w-sm">
        <div className="flex h-16 shrink-0 items-center border-b px-5">
          <SheetTitle className="sr-only">Menú</SheetTitle>
          <Logo variant="wordmark" className="h-8 w-auto" />
        </div>

        <nav aria-label="Menú de la tienda" className="flex flex-col gap-6 px-3 py-5">
          {/* El link viene armado del servidor: el clic acá lo cierra igual que los demás */}
          <div onClick={close}>{account}</div>

          <Link
            href={ALL_PRODUCTS_LINK.href}
            onClick={close}
            className="flex items-center gap-3 rounded-xl px-3 py-3 font-medium transition-colors hover:bg-muted"
          >
            <span className="flex size-10 items-center justify-center rounded-full bg-brand-soft text-brand">
              <LayoutGrid className="size-5" aria-hidden />
            </span>
            {ALL_PRODUCTS_LINK.label}
            <ChevronRight className="ml-auto size-4 text-muted-foreground" aria-hidden />
          </Link>

          {categories.length > 0 && (
            <MenuGroup title="Categorías">
              {categories.map((c) =>
                c.children.length > 0 ? (
                  <CategoryAccordion key={c.id} category={c} onNavigate={close} />
                ) : (
                  <li key={c.id}>
                    <Link
                      href={categoryHref(c.slug)}
                      onClick={close}
                      className="flex min-h-14 items-center gap-3 rounded-xl px-3 py-2 font-medium transition-colors hover:bg-muted"
                    >
                      <CategoryThumb imageUrl={c.imageUrl} />
                      {c.name}
                    </Link>
                  </li>
                ),
              )}
            </MenuGroup>
          )}

          <MenuGroup title="Ayuda">
            {HELP_LINKS.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  onClick={close}
                  className="block rounded-xl px-3 py-2.5 transition-colors hover:bg-muted"
                >
                  {l.label}
                </Link>
              </li>
            ))}
            {/* Botón de arrepentimiento (Disp. 954/2025): destacado, a simple vista */}
            <li>
              <Link
                href={WITHDRAWAL_LINK.href}
                onClick={close}
                className="mt-1 flex items-center gap-2 rounded-xl px-3 py-2.5 font-semibold text-brand transition-colors hover:bg-brand-soft"
              >
                <Undo2 className="size-4" aria-hidden />
                {WITHDRAWAL_LINK.label}
              </Link>
            </li>
          </MenuGroup>

          <MenuGroup title="Legales">
            {LEGAL_LINKS.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  onClick={close}
                  className="block rounded-xl px-3 py-2.5 transition-colors hover:bg-muted"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </MenuGroup>

          {redes.length > 0 && (
            <div className="flex flex-col gap-3 px-3">
              <h2 className="text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">
                Seguinos y consultanos
              </h2>
              <SocialLinks redes={redes} />
            </div>
          )}
        </nav>
      </SheetContent>
    </Sheet>
  );
}

function CategoryThumb({ imageUrl }: { imageUrl: string | null }) {
  return (
    <span className="relative size-10 shrink-0 overflow-hidden rounded-lg bg-muted">
      {imageUrl && <Image src={imageUrl} alt="" fill sizes="40px" className="object-cover" />}
    </span>
  );
}

/**
 * Principal con subcategorías: la fila abre y cierra la lista (flecha ▾ que
 * gira) con las subcategorías y "Ver todo Cocina". Filas de 44 px o más.
 */
function CategoryAccordion({ category, onNavigate }: { category: StoreCategoryNode; onNavigate: () => void }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  return (
    <li>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-14 w-full items-center gap-3 rounded-xl px-3 py-2 text-left font-medium transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/20 focus-visible:outline-none"
      >
        <CategoryThumb imageUrl={category.imageUrl} />
        {category.name}
        <ChevronDown
          aria-hidden
          className={cn("ml-auto size-4 text-muted-foreground transition-transform duration-200", open && "rotate-180")}
        />
      </button>
      {/* Altura animada con grid (0fr → 1fr); cerrada, no se puede tabular */}
      <div
        id={panelId}
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
        inert={!open}
      >
        <ul className="ml-6.5 min-h-0 divide-y divide-border/60 overflow-hidden border-l border-border/80 pl-3">
          {category.children.map((s) => (
            <li key={s.id}>
              <Link
                href={categoryHref(category.slug, s.slug)}
                onClick={onNavigate}
                className="flex min-h-11 items-center rounded-lg px-3 text-[15px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {s.name}
              </Link>
            </li>
          ))}
          <li>
            <Link
              href={categoryHref(category.slug)}
              onClick={onNavigate}
              className="flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-[15px] font-semibold text-brand transition-colors hover:bg-brand-soft"
            >
              Ver todo {category.name}
              <ChevronRight aria-hidden className="size-4" />
            </Link>
          </li>
        </ul>
      </div>
    </li>
  );
}

function MenuGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <h2 className="px-3 pb-1 text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">
        {title}
      </h2>
      <ul className="flex flex-col">{children}</ul>
    </div>
  );
}
