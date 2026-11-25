"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronRight, LayoutGrid, Menu, Undo2 } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { SocialLinks } from "@/components/social-links";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { StoreCategory } from "@/lib/store-data";
import { ALL_PRODUCTS_LINK, categoryHref, HELP_LINKS, LEGAL_LINKS, WITHDRAWAL_LINK } from "@/lib/store-nav";
import type { RedSocial } from "@/lib/store-settings";

/**
 * Menú hamburguesa de la tienda (panel que entra desde la izquierda):
 * todos los productos, categorías con su foto, ayuda (con el Botón de
 * arrepentimiento destacado), legales y redes.
 * Se cierra solo al tocar un link.
 */
export function StoreMenu({
  categories,
  redes,
  account,
}: {
  categories: StoreCategory[];
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
              {categories.map((c) => (
                <li key={c.id}>
                  <Link
                    href={categoryHref(c.slug)}
                    onClick={close}
                    className="flex items-center gap-3 rounded-xl px-3 py-2 transition-colors hover:bg-muted"
                  >
                    <span className="relative size-10 shrink-0 overflow-hidden rounded-lg bg-muted">
                      {c.imageUrl && (
                        <Image src={c.imageUrl} alt="" fill sizes="40px" className="object-cover" />
                      )}
                    </span>
                    {c.name}
                  </Link>
                </li>
              ))}
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
