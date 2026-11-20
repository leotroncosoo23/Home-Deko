"use client";

import { ShoppingBag } from "lucide-react";
import { productCountLabel } from "@/lib/cart";
import { useCart } from "./cart/cart-provider";

/**
 * Ícono del carrito en el encabezado: abre el panel del carrito y muestra
 * cuántas unidades hay.
 *
 *   escritorio → "🛍 Carrito (3)"
 *   celular    → ícono con una burbuja roja con el número
 *
 * data-cart-target: hacia acá vuela la foto al agregar un producto
 * (src/components/store/cart/fly-to-cart.ts).
 */
export function CartButton({ withText = false }: { withText?: boolean }) {
  const { count, openCart } = useCart();
  const label = count > 0 ? `Carrito, ${productCountLabel(count)}` : "Carrito, vacío";

  if (withText) {
    return (
      <button
        type="button"
        onClick={openCart}
        aria-label={label}
        className="inline-flex h-10 items-center gap-2 rounded-full px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/20 focus-visible:outline-none"
      >
        <span data-cart-target className="inline-flex">
          <ShoppingBag className="size-5" aria-hidden />
        </span>
        Carrito <span className="tabular-nums">({count})</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={openCart}
      aria-label={label}
      className="-mr-1.5 inline-flex size-10 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/20 focus-visible:outline-none"
    >
      <span data-cart-target className="relative inline-flex">
        <ShoppingBag className="size-[22px]" aria-hidden />
        {count > 0 && (
          <span
            aria-hidden
            className="absolute -top-1.5 -right-2 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-brand px-1 text-[11px] leading-none font-semibold text-white tabular-nums ring-2 ring-background"
          >
            {count > 99 ? "99+" : count}
          </span>
        )}
      </span>
    </button>
  );
}
