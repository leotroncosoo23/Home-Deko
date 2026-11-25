"use client";

import Link from "next/link";
import { Check, ShoppingBag, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCart } from "./cart-provider";
import { useAddedFlash } from "./use-added-flash";

/**
 * Botón rápido de la tarjeta de producto, con texto en todos los tamaños:
 *   - una sola variante → "Agregar" (suma 1 al carrito, con la animación de
 *     vuelo al carrito)
 *   - varias            → "Ver opciones" (lleva a la página del producto)
 * (Sin stock, la tarjeta no lo muestra.)
 * En el celular es un poco más bajo (las tarjetas van de a 2 por fila).
 */
export function QuickAdd({
  variantId,
  href,
  name,
  imageUrl,
}: {
  /** null → tiene varias variantes: "Ver opciones". */
  variantId: string | null;
  href: string;
  name: string;
  imageUrl: string | null;
}) {
  const { add } = useCart();
  const [added, flash] = useAddedFlash();

  const base =
    "inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-full px-3 text-[13px] font-semibold whitespace-nowrap md:h-10 md:gap-2 md:px-4 md:text-sm";
  const look =
    "border border-brand/30 text-brand transition-colors hover:border-brand hover:bg-brand hover:text-white focus-visible:ring-3 focus-visible:ring-brand/30 focus-visible:outline-none";

  if (!variantId) {
    return (
      <Link href={href} aria-label={`Ver opciones de ${name}`} className={cn(base, look)}>
        <SlidersHorizontal aria-hidden className="size-3.5 md:size-4" />
        Ver opciones
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
      {added ? (
        <>
          Agregado <Check aria-hidden className="size-3.5 md:size-4" strokeWidth={3} />
        </>
      ) : (
        <>
          <ShoppingBag aria-hidden className="size-3.5 md:size-4" />
          Agregar
        </>
      )}
    </button>
  );
}
