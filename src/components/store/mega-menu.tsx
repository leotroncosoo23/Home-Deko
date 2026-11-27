"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "cn";
import type { StoreCategoryNode } from "@/lib/store-data";
import { STORE_CONTAINER } from "@/lib/store-layout";
import { categoryHref } from "@/lib/store-nav";

/** Subcategorías por columna (después, una columna nueva). */
const PER_COLUMN = 6;

/**
 * Panel del mega menú (PC): a todo el ancho, debajo de la barra de
 * categorías. Lo abre y cierra CategoryBar (hover con demora, clic,
 * Escape, clic afuera).
 *
 *   Cocina                                         ┌──────────────┐
 *   Ollas y sartenes    Vajilla                    │  foto de     │
 *   Utensilios          Termos                     │  portada     │
 *   …                                              │  [Ver todo]  │
 *   Ver todo Cocina →                              └──────────────┘
 */
export function MegaPanel({
  id,
  category,
  onNavigate,
  onPointerEnter,
  onPointerLeave,
}: {
  id: string;
  category: StoreCategoryNode;
  onNavigate: () => void;
  onPointerEnter: () => void;
  onPointerLeave: () => void;
}) {
  const allHref = categoryHref(category.slug);
  const rows = Math.min(PER_COLUMN, category.children.length);

  return (
    <div
      id={id}
      role="region"
      aria-label={`Subcategorías de ${category.name}`}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      className="animate-mega-menu absolute inset-x-0 top-full z-40 border-t bg-background shadow-[0_24px_40px_-24px_rgb(43_43_43/0.28)]"
    >
      <div className={cn(STORE_CONTAINER, "flex items-stretch justify-between gap-12 py-8")}>
        <div className="flex min-w-0 flex-col">
          <p className="font-display text-[26px] leading-tight font-semibold tracking-tight">{category.name}</p>
          <ul
            className="mt-5 grid grid-flow-col gap-x-14 gap-y-0.5"
            style={{ gridTemplateRows: `repeat(${rows}, auto)`, gridAutoColumns: "minmax(10rem, 13rem)" }}
          >
            {category.children.map((sub) => (
              <li key={sub.id}>
                <Link
                  href={categoryHref(category.slug, sub.slug)}
                  onClick={onNavigate}
                  className="-mx-2 block rounded-md px-2 py-1.5 text-[15px] leading-6 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/20 focus-visible:outline-none"
                >
                  {sub.name}
                </Link>
              </li>
            ))}
          </ul>
          <Link
            href={allHref}
            onClick={onNavigate}
            className="group/all mt-6 inline-flex w-fit items-center gap-1.5 rounded-md text-[15px] font-semibold text-brand focus-visible:ring-3 focus-visible:ring-ring/20 focus-visible:outline-none"
          >
            Ver todo {category.name}
            <ArrowRight aria-hidden className="size-4 transition-transform group-hover/all:translate-x-0.5" />
          </Link>
        </div>

        {category.imageUrl && (
          <Link
            href={allHref}
            onClick={onNavigate}
            tabIndex={-1}
            aria-hidden
            className="group/photo relative hidden aspect-[16/10] w-[min(36%,26rem)] shrink-0 overflow-hidden rounded-2xl bg-muted xl:block"
          >
            <Image
              src={category.imageUrl}
              alt=""
              fill
              sizes="416px"
              className="object-cover transition-transform duration-500 ease-out group-hover/photo:scale-[1.03]"
            />
            <span className="absolute bottom-4 left-4 inline-flex items-center gap-1.5 rounded-full bg-background px-4 py-2 text-sm font-semibold text-foreground shadow-sm">
              Ver todo
              <ArrowRight aria-hidden className="size-3.5" />
            </span>
          </Link>
        )}
      </div>
    </div>
  );
}
