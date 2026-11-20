"use client";

import Link from "next/link";
import { Check, ShoppingBag, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCart } from "./cart-provider";
import { useAddedFlash } from "./use-added-flash";

/**
 * Botón rápido de la tarjeta de producto:
 *   - una sola variante → "Agregar" (suma 1 al carrito, con la animación)
 *   - varias            → "Elegir opciones" (lleva a la página del producto)
 * (Sin stock, la tarjeta no lo muestra.)
 *
 *   size="icon": celular, botón chico redondo al lado del precio (no tapa la foto)
 *   size="full": desde tablet, botón con texto debajo del precio
 */
export function QuickAdd({
  variantId,
  href,
  name,
  imageUrl,
  size,
}: {
  /** null → tiene varias variantes: "Elegir opciones". */
  variantId: string | null;
  href: string;
  name: string;
  imageUrl: string | null;
  size: "icon" | "full";
}) {
  const { add } = useCart();
  const [added, flash] = useAddedFlash();

  const base =
    size === "icon"
      ? "inline-flex size-9 shrink-0 items-center justify-center rounded-full"
      : "inline-flex h-10 w-full items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold";
  const look =
    "border border-brand/30 text-brand transition-colors hover:border-brand hover:bg-brand hover:text-white focus-visible:ring-3 focus-visible:ring-brand/30 focus-visible:outline-none";

  if (!variantId) {
    return (
      <Link
        href={href}
        aria-label={size === "icon" ? `Elegir opciones de ${name}` : undefined}
        className={cn(base, look)}
      >
        {size === "icon" ? <SlidersHorizontal aria-hidden className="size-4" /> : "Elegir opciones"}
      </Link>
    );
  }

  const id = variantId;
  function handleClick(e: React.MouseEvent<HTMLButtonElement>) {
    // La foto de ESTA tarjeta: desde ahí sale volando la miniatura.
    const source = e.currentTarget.closest("[data-product-card]")?.querySelector<HTMLElement>("[data-card-image]");
    add({ variantId: id, qty: 1, name, imageUrl, source });
    flash();
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={added ? `${name}: agregado al carrito` : `Agregar ${name} al carrito`}
      className={cn(base, look, added && "border-brand bg-brand text-white")}
    >
      {size === "icon" ? (
        added ? (
          <Check aria-hidden className="size-4" strokeWidth={3} />
        ) : (
          <ShoppingBag aria-hidden className="size-4" />
        )
      ) : added ? (
        <>
          Agregado <Check aria-hidden className="size-4" strokeWidth={3} />
        </>
      ) : (
        <>
          <ShoppingBag aria-hidden className="size-4" />
          Agregar
        </>
      )}
    </button>
  );
}
