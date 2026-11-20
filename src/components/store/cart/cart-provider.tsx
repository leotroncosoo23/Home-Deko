"use client";

import { createContext, use, useCallback, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { CartItem } from "@/lib/cart";
import { CartSheet } from "./cart-sheet";
import { CartToast, type ToastData } from "./cart-toast";
import { addCartItem, getCartServerSnapshot, getCartSnapshot, subscribeCart } from "./cart-store";
import { bounce, findCartTarget, flyToCart, prefersReducedMotion } from "./fly-to-cart";

/**
 * Estado del carrito para toda la tienda (se monta una vez en StoreFrame):
 *
 *   - items: lo guardado en el navegador ({ variantId, qty }).
 *   - count: unidades que muestra el ícono. Mientras la foto "vuela", esas
 *     unidades todavía no se cuentan: el número sube cuando llega.
 *   - add(): suma al carrito + animación + aviso chico bajo el carrito.
 *   - un único panel del carrito y un único aviso para toda la tienda.
 */

export type AddToCartInput = {
  variantId: string;
  qty: number;
  /** Tope de unidades (stock), si se conoce. */
  max?: number;
  name: string;
  imageUrl: string | null;
  /** La foto desde la que sale volando la miniatura. */
  source?: HTMLElement | null;
};

type CartContextValue = {
  items: CartItem[];
  count: number;
  qtyInCart: (variantId: string) => number;
  add: (input: AddToCartInput) => void;
  openCart: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function useCart(): CartContextValue {
  const ctx = use(CartContext);
  if (!ctx) throw new Error("useCart tiene que usarse dentro de <CartProvider>.");
  return ctx;
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const items = useSyncExternalStore(subscribeCart, getCartSnapshot, getCartServerSnapshot);
  const [open, setOpen] = useState(false);
  const [inFlight, setInFlight] = useState(0);
  const [toast, setToast] = useState<ToastData | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const toastId = useRef(0);

  const total = items.reduce((sum, i) => sum + i.qty, 0);
  const count = Math.max(0, total - inFlight);

  // Estable (useCallback): el aviso la usa en su temporizador de 3 s.
  const closeToast = useCallback(() => setToast(null), []);

  const openCart = useCallback(() => {
    setToast(null);
    setOpen(true);
  }, []);

  const add = useCallback((input: AddToCartInput) => {
    const before = getCartSnapshot().find((i) => i.variantId === input.variantId)?.qty ?? 0;
    addCartItem(input.variantId, input.qty, input.max);
    const after = getCartSnapshot().find((i) => i.variantId === input.variantId)?.qty ?? 0;
    const added = after - before;

    // added = 0: ya tenía en el carrito todas las unidades que hay.
    const title = added > 0 ? "Agregado al carrito" : "Ya está en tu carrito";
    const spoken =
      added > 0
        ? `Agregaste ${input.name} al carrito.`
        : `${input.name} ya está en tu carrito con todas las unidades disponibles.`;

    const showToast = () => {
      toastId.current += 1;
      setToast({ id: toastId.current, title, name: input.name, imageUrl: input.imageUrl });
      // Para lectores de pantalla: se vacía y se vuelve a escribir, así se
      // anuncia aunque agreguen dos veces lo mismo.
      setAnnouncement("");
      window.setTimeout(() => setAnnouncement(spoken), 60);
    };

    const target = findCartTarget();
    if (!target || prefersReducedMotion() || added <= 0) {
      showToast();
      return;
    }

    // El número sube cuando la miniatura llega al carrito.
    setInFlight((n) => n + added);
    flyToCart(input.source ?? null, target).then(() => {
      setInFlight((n) => Math.max(0, n - added));
      bounce(target);
      showToast();
    });
  }, []);

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      count,
      qtyInCart: (variantId) => items.find((i) => i.variantId === variantId)?.qty ?? 0,
      add,
      openCart,
    }),
    [items, count, add, openCart],
  );

  return (
    <CartContext value={value}>
      {children}
      <CartSheet open={open} onOpenChange={setOpen} items={items} />
      <CartToast toast={toast} onClose={closeToast} onViewCart={openCart} />
      {/* Siempre presente (si se crea junto con el texto, algunos lectores no lo anuncian) */}
      <div role="status" aria-live="polite" className="sr-only">
        {announcement}
      </div>
    </CartContext>
  );
}
