"use client";

import { useState } from "react";
import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ALL_PRODUCTS_LINK } from "@/lib/store-nav";

/**
 * Ícono del carrito en el encabezado. Abre el panel del carrito (por ahora
 * siempre vacío: el carrito con productos y el pago se suman en el paso 4).
 */
export function CartButton({ withText = false }: { withText?: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {withText ? (
        // Escritorio: "Carrito (0)" con texto.
        <SheetTrigger className="inline-flex h-10 items-center gap-2 rounded-full px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/20 focus-visible:outline-none">
          <ShoppingBag className="size-5" aria-hidden />
          Carrito <span className="tabular-nums">(0)</span>
        </SheetTrigger>
      ) : (
        // Celular: solo el ícono.
        <SheetTrigger
          aria-label="Carrito, vacío"
          className="-mr-1.5 inline-flex size-10 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/20 focus-visible:outline-none"
        >
          <ShoppingBag className="size-[22px]" aria-hidden />
        </SheetTrigger>
      )}

      <SheetContent side="right" className="w-[85%] sm:max-w-sm">
        <div className="flex h-16 shrink-0 items-center border-b px-5">
          <SheetTitle className="font-display text-xl font-semibold">Tu carrito</SheetTitle>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 pb-16 text-center">
          <span className="flex size-16 items-center justify-center rounded-full bg-brand-soft text-brand">
            <ShoppingBag className="size-7" aria-hidden />
          </span>
          <div className="flex flex-col gap-1">
            <p className="text-lg font-semibold">Tu carrito está vacío</p>
            <SheetDescription className="text-[15px] text-muted-foreground">
              Mirá nuestros productos y encontrá algo lindo para tu casa.
            </SheetDescription>
          </div>
          <Link
            href={ALL_PRODUCTS_LINK.href}
            onClick={() => setOpen(false)}
            className="inline-flex h-11 items-center justify-center rounded-full bg-brand px-6 font-semibold text-white transition-colors hover:bg-brand-hover focus-visible:ring-3 focus-visible:ring-brand/30 focus-visible:outline-none"
          >
            Ver productos
          </Link>
        </div>
      </SheetContent>
    </Sheet>
  );
}
