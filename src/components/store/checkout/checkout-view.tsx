"use client";

import { useEffect, useState, useSyncExternalStore, useTransition } from "react";
import Link from "next/link";
import { AlertCircle, ShoppingBag } from "lucide-react";
import { getCartLines } from "@/app/(tienda)/actions";
import type { CartData } from "@/lib/cart";
import { ALL_PRODUCTS_LINK } from "@/lib/store-nav";
import { useCart } from "../cart/cart-provider";
import { reconcileCart } from "../cart/cart-sheet";
import { getCartSnapshot } from "../cart/cart-store";
import { CheckoutForm, type StoreInfo } from "./checkout-form";

const noop = () => () => {};

/**
 * /finalizar-compra (parte del navegador).
 *
 * Lee el carrito (solo { variantId, qty }), le pide al servidor los datos
 * reales (getCartLines) y muestra el formulario. Si algo cambió (sin stock,
 * despublicado), ajusta el carrito y avisa, igual que el panel del carrito.
 */
export function CheckoutView({ store }: { store: StoreInfo }) {
  const { items } = useCart();
  // false en el servidor y en el primer dibujo: evita mostrar "carrito
  // vacío" un instante antes de leer el carrito del navegador.
  const hydrated = useSyncExternalStore(noop, () => true, () => false);
  const [data, setData] = useState<CartData | null>(null);
  const [notices, setNotices] = useState<string[]>([]);
  const [failed, setFailed] = useState(false);
  const [reload, setReload] = useState(0);
  const [, startLoading] = useTransition();

  const key = items.map((i) => `${i.variantId}:${i.qty}`).join(",");

  useEffect(() => {
    if (!key) return;
    startLoading(async () => {
      try {
        const result = await getCartLines(getCartSnapshot());
        const fixes = reconcileCart(result.lines);
        startLoading(() => {
          setData(result);
          setFailed(false);
          if (fixes.length) setNotices((prev) => [...prev, ...fixes]);
        });
      } catch {
        startLoading(() => setFailed(true));
      }
    });
  }, [key, reload]);

  if (!hydrated) return <CheckoutSkeleton />;
  if (items.length === 0) return <EmptyCheckout notices={notices} />;
  if (failed) {
    return (
      <div className="flex max-w-md flex-col items-start gap-3 rounded-2xl bg-muted p-5 text-[15px]">
        <p>No pudimos cargar tu carrito. Revisá tu conexión e intentá de nuevo.</p>
        <button
          type="button"
          onClick={() => setReload((n) => n + 1)}
          className="font-semibold underline underline-offset-4"
        >
          Reintentar
        </button>
      </div>
    );
  }
  if (!data) return <CheckoutSkeleton />;

  // Lo que se muestra: lo disponible que sigue en el carrito, con su cantidad.
  const qtyById = new Map(items.map((i) => [i.variantId, i.qty]));
  const lines = data.lines
    .filter((l) => l.status !== "unavailable" && qtyById.has(l.variantId))
    .map((l) => ({ ...l, qty: Math.min(qtyById.get(l.variantId) ?? l.qty, l.maxQty) }));

  return (
    <div className="flex flex-col gap-5">
      {notices.length > 0 && <Notices notices={notices} />}
      <CheckoutForm
        lines={lines}
        shippingCost={data.shippingCost}
        store={store}
        onCartChanged={() => setReload((n) => n + 1)}
      />
    </div>
  );
}

export function Notices({ notices }: { notices: string[] }) {
  return (
    <div role="alert" className="flex flex-col gap-1.5 rounded-xl bg-amber-50 p-3.5 text-sm text-amber-950">
      {notices.map((n, i) => (
        <p key={i} className="flex gap-2">
          <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0 text-amber-600" />
          {n}
        </p>
      ))}
    </div>
  );
}

function EmptyCheckout({ notices }: { notices: string[] }) {
  return (
    <div className="flex flex-col gap-5">
      {notices.length > 0 && <Notices notices={notices} />}
      <div className="flex flex-col items-center gap-4 py-10 text-center">
        <span className="flex size-16 items-center justify-center rounded-full bg-brand-soft text-brand">
          <ShoppingBag aria-hidden className="size-7" />
        </span>
        <div className="flex flex-col gap-1">
          <p className="text-lg font-semibold">Tu carrito está vacío</p>
          <p className="text-[15px] text-muted-foreground">Mirá nuestros productos y encontrá algo lindo para tu casa.</p>
        </div>
        <Link
          href={ALL_PRODUCTS_LINK.href}
          className="inline-flex h-11 items-center justify-center rounded-full bg-brand px-6 font-semibold text-white transition-colors hover:bg-brand-hover focus-visible:ring-3 focus-visible:ring-brand/30 focus-visible:outline-none"
        >
          Ver productos
        </Link>
      </div>
    </div>
  );
}

function CheckoutSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-10" aria-label="Cargando">
      <div className="flex flex-col gap-5">
        {[0, 1].map((i) => (
          <div key={i} className="flex flex-col gap-3 rounded-2xl border p-5">
            <div className="h-5 w-32 animate-pulse rounded bg-muted" />
            <div className="h-11 animate-pulse rounded-xl bg-muted" />
            <div className="h-11 animate-pulse rounded-xl bg-muted" />
          </div>
        ))}
      </div>
      <div className="h-72 animate-pulse rounded-2xl bg-muted" />
    </div>
  );
}
