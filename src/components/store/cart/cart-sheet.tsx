"use client";

import { useEffect, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { AlertCircle, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { getCartLines } from "@/app/(tienda)/actions";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { productCountLabel, type CartData, type CartItem, type CartLine } from "@/lib/cart";
import { formatARS } from "@/lib/format";
import { ALL_PRODUCTS_LINK, CHECKOUT_PATH, productHref } from "@/lib/store-nav";
import { cn } from "@/lib/utils";
import { getCartSnapshot, removeCartItem, replaceCart, setCartItemQty } from "./cart-store";

/**
 * Panel del carrito (desde la derecha).
 *
 * Cada vez que se abre (o cambia qué productos hay), le pide al servidor
 * los datos reales: precio, stock y si sigue a la venta. Con eso ajusta lo
 * guardado en el navegador y avisa:
 *   - "«Mantel» ya no está disponible" → se saca del carrito.
 *   - quedan menos unidades → se baja la cantidad.
 */
export function CartSheet({
  open,
  onOpenChange,
  items,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: CartItem[];
}) {
  const [data, setData] = useState<CartData | null>(null);
  const [notices, setNotices] = useState<string[]>([]);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [loading, startLoading] = useTransition();

  // Solo cambia si cambian QUÉ variantes hay (no las cantidades): sumar o
  // restar una unidad no vuelve a consultar al servidor.
  const idsKey = items
    .map((i) => i.variantId)
    .sort()
    .join(",");

  useEffect(() => {
    if (!open || !idsKey) return;
    startLoading(async () => {
      try {
        const result = await getCartLines(getCartSnapshot());
        const fixes = reconcile(result.lines);
        startLoading(() => {
          setData(result);
          setFailed(false);
          if (fixes.length) setNotices((prev) => [...prev, ...fixes]);
        });
      } catch {
        startLoading(() => setFailed(true));
      }
    });
  }, [open, idsKey, retry]);

  function handleOpenChange(next: boolean) {
    onOpenChange(next);
    // Los avisos se leen una vez: al cerrar, se borran.
    if (!next) setNotices([]);
  }

  // Las líneas que se muestran: las disponibles que siguen en el carrito,
  // con la cantidad de este momento (la puede cambiar con − / +).
  const qtyById = new Map(items.map((i) => [i.variantId, i.qty]));
  const lines = (data?.lines ?? [])
    .filter((l) => l.status !== "unavailable" && qtyById.has(l.variantId))
    .map((l) => ({ ...l, qty: Math.min(qtyById.get(l.variantId) ?? l.qty, l.maxQty) }));
  const units = lines.reduce((s, l) => s + l.qty, 0);
  const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
  const isEmpty = items.length === 0;
  const firstLoad = !isEmpty && !data && !failed;

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="w-[92%] gap-0 sm:max-w-md">
        <div className="flex h-16 shrink-0 items-center border-b px-5">
          <SheetTitle className="font-display text-xl font-semibold">
            Tu carrito
            {!isEmpty && units > 0 && (
              <span className="ml-2 font-sans text-sm font-normal text-muted-foreground tabular-nums">
                ({productCountLabel(units)})
              </span>
            )}
          </SheetTitle>
        </div>

        {isEmpty ? (
          <EmptyCart notices={notices} />
        ) : (
          <>
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto" aria-busy={loading}>
              {notices.length > 0 && <Notices notices={notices} />}
              {failed && (
                <div className="m-5 flex flex-col items-start gap-2 rounded-xl bg-muted p-4 text-sm">
                  <p>No pudimos actualizar tu carrito. Revisá tu conexión e intentá de nuevo.</p>
                  <button
                    type="button"
                    onClick={() => setRetry((n) => n + 1)}
                    className="font-semibold underline underline-offset-4"
                  >
                    Reintentar
                  </button>
                </div>
              )}
              {firstLoad ? (
                <LinesSkeleton count={items.length} />
              ) : (
                <ul className="divide-y px-5">
                  {lines.map((line) => (
                    <CartLineRow key={line.variantId} line={line} onNavigate={() => handleOpenChange(false)} />
                  ))}
                </ul>
              )}
            </div>

            <div className="flex shrink-0 flex-col gap-3 border-t bg-background px-5 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
              <dl className="flex flex-col gap-1.5 text-sm">
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-base font-semibold">Subtotal</dt>
                  <dd className="text-lg font-semibold tabular-nums">
                    {data ? formatARS(subtotal) : <span className="inline-block h-5 w-24 animate-pulse rounded bg-muted" />}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-4 text-muted-foreground">
                  <dt>Envío</dt>
                  <dd className="text-right">
                    {data ? (
                      <>
                        <span className="tabular-nums">{formatARS(data.shippingCost).replace(/,00$/, "")}</span> a
                        domicilio o retiro gratis
                      </>
                    ) : (
                      "—"
                    )}
                  </dd>
                </div>
                <p className="text-xs text-muted-foreground">Elegís cómo recibirlo al finalizar la compra.</p>
              </dl>
              <Link
                href={CHECKOUT_PATH}
                onClick={() => handleOpenChange(false)}
                aria-disabled={lines.length === 0}
                className={cn(
                  "inline-flex h-12 items-center justify-center rounded-full bg-brand px-6 text-[15px] font-semibold text-white transition-colors hover:bg-brand-hover focus-visible:ring-3 focus-visible:ring-brand/30 focus-visible:outline-none",
                  lines.length === 0 && "pointer-events-none opacity-50",
                )}
              >
                Iniciar compra
              </Link>
              <SheetClose className="inline-flex h-11 items-center justify-center rounded-full border px-6 font-semibold transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/20 focus-visible:outline-none">
                Seguir comprando
              </SheetClose>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

/**
 * Ajusta lo guardado en el navegador con lo que dijo el servidor y
 * devuelve los avisos para el cliente.
 */
function reconcile(lines: CartLine[]): string[] {
  const notices: string[] = [];
  const current = getCartSnapshot();
  const byId = new Map(lines.map((l) => [l.variantId, l]));
  let changed = false;

  const next = current.flatMap((item) => {
    const line = byId.get(item.variantId);
    if (!line) return [item];
    const label = line.name ? `«${line.name}${line.variantLabel ? ` (${line.variantLabel})` : ""}»` : null;
    if (line.status === "unavailable") {
      changed = true;
      notices.push(
        label
          ? `${label} ya no está disponible y lo sacamos de tu carrito.`
          : "Un producto de tu carrito ya no está disponible y lo sacamos.",
      );
      return [];
    }
    if (item.qty > line.maxQty) {
      changed = true;
      notices.push(`De ${label} quedan menos unidades: ajustamos la cantidad.`);
      return [{ ...item, qty: line.maxQty }];
    }
    return [item];
  });

  if (changed) replaceCart(next);
  return notices;
}

function Notices({ notices }: { notices: string[] }) {
  return (
    <div role="alert" className="mx-5 mt-4 flex flex-col gap-1.5 rounded-xl bg-amber-50 p-3.5 text-sm text-amber-950">
      {notices.map((n, i) => (
        <p key={i} className="flex gap-2">
          <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0 text-amber-600" />
          {n}
        </p>
      ))}
    </div>
  );
}

function CartLineRow({ line, onNavigate }: { line: CartLine; onNavigate: () => void }) {
  const name = line.name ?? "";
  const href = line.slug ? productHref(line.slug) : ALL_PRODUCTS_LINK.href;
  const atMax = line.qty >= line.maxQty;

  return (
    <li className="flex gap-3.5 py-4">
      <Link
        href={href}
        onClick={onNavigate}
        tabIndex={-1}
        aria-hidden
        className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-muted"
      >
        {line.imageUrl ? (
          <Image src={line.imageUrl} alt="" fill sizes="80px" className="object-cover" />
        ) : (
          <span className="flex h-full items-center justify-center">
            <ShoppingBag aria-hidden className="size-6 text-muted-foreground/40" />
          </span>
        )}
      </Link>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link
              href={href}
              onClick={onNavigate}
              className="line-clamp-2 text-[15px] leading-snug font-medium hover:underline hover:underline-offset-4"
            >
              {name}
            </Link>
            {line.variantLabel && <p className="text-sm text-muted-foreground">{line.variantLabel}</p>}
          </div>
          <button
            type="button"
            onClick={() => removeCartItem(line.variantId)}
            aria-label={`Eliminar ${name} del carrito`}
            className="-mt-1 -mr-1.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/20 focus-visible:outline-none"
          >
            <Trash2 aria-hidden className="size-4" />
          </button>
        </div>

        <div className="mt-auto flex items-end justify-between gap-3">
          <div className="flex flex-col gap-1">
            <div className="inline-flex h-9 items-center rounded-full border">
              <button
                type="button"
                onClick={() => setCartItemQty(line.variantId, line.qty - 1)}
                disabled={line.qty <= 1}
                aria-label={`Restar una unidad de ${name}`}
                className="inline-flex size-9 items-center justify-center rounded-full transition-colors hover:bg-muted disabled:opacity-35 disabled:hover:bg-transparent"
              >
                <Minus aria-hidden className="size-3.5" />
              </button>
              <span className="min-w-7 text-center text-sm font-semibold tabular-nums" aria-label={`Cantidad: ${line.qty}`}>
                {line.qty}
              </span>
              <button
                type="button"
                onClick={() => setCartItemQty(line.variantId, line.qty + 1)}
                disabled={atMax}
                aria-label={`Sumar una unidad de ${name}`}
                className="inline-flex size-9 items-center justify-center rounded-full transition-colors hover:bg-muted disabled:opacity-35 disabled:hover:bg-transparent"
              >
                <Plus aria-hidden className="size-3.5" />
              </button>
            </div>
            {atMax && line.maxQty > 1 && <p className="text-xs text-muted-foreground">No hay más unidades</p>}
          </div>
          <p className="flex flex-col items-end tabular-nums">
            <span className={cn("font-semibold", line.unitPriceBefore && "text-brand")}>
              {formatARS(line.unitPrice * line.qty)}
            </span>
            {line.unitPriceBefore && (
              <span className="text-xs text-muted-foreground line-through">
                <span className="sr-only">Antes: </span>
                {formatARS(line.unitPriceBefore * line.qty)}
              </span>
            )}
          </p>
        </div>
      </div>
    </li>
  );
}

function LinesSkeleton({ count }: { count: number }) {
  return (
    <div className="flex flex-col divide-y px-5" aria-label="Cargando tu carrito">
      {Array.from({ length: Math.min(count, 4) }, (_, i) => (
        <div key={i} className="flex gap-3.5 py-4">
          <div className="size-20 animate-pulse rounded-xl bg-muted" />
          <div className="flex flex-1 flex-col gap-2 pt-1">
            <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
            <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Carrito vacío (puede venir con el aviso de que se sacó algo que ya no está). */
function EmptyCart({ notices }: { notices: string[] }) {
  return (
    <div className="flex flex-1 flex-col">
      {notices.length > 0 && <Notices notices={notices} />}
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
        {/* Navega Y cierra el panel: es un link, no un botón (nativeButton={false}). */}
        <SheetClose
          nativeButton={false}
          render={<Link href={ALL_PRODUCTS_LINK.href} />}
          className="inline-flex h-11 items-center justify-center rounded-full bg-brand px-6 font-semibold text-white transition-colors hover:bg-brand-hover focus-visible:ring-3 focus-visible:ring-brand/30 focus-visible:outline-none"
        >
          Ver productos
        </SheetClose>
      </div>
    </div>
  );
}
