"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Check, X } from "lucide-react";
import { findCartTarget } from "./fly-to-cart";

export type ToastData = {
  /** Cambia en cada aviso: reinicia el contador de 3 s. */
  id: number;
  title: string;
  name: string;
  imageUrl: string | null;
};

const VISIBLE_MS = 3000;
/** Separación con el borde de la pantalla (el aviso nunca queda cortado). */
const EDGE = 12;

/**
 * Aviso chico debajo del ícono del carrito, durante 3 s: foto, nombre y
 * "Ver carrito". No abre el panel solo (eso interrumpiría la compra).
 * Se queda mientras el mouse o el foco estén encima.
 *
 * Para lectores de pantalla, el anuncio lo hace la región role="status" de
 * cart-provider.tsx (este aviso aparece y desaparece; esa región, no).
 */
export function CartToast({
  toast,
  onClose,
  onViewCart,
}: {
  toast: ToastData | null;
  onClose: () => void;
  onViewCart: () => void;
}) {
  if (!toast) return null;
  // key: cada aviso nuevo arranca de cero (posición y contador).
  return <ToastCard key={toast.id} toast={toast} onClose={onClose} onViewCart={onViewCart} />;
}

/** Debajo del ícono visible del carrito, alineado a su borde derecho. */
function positionUnderCart(): { top: number; right: number } {
  const target = findCartTarget();
  if (!target) return { top: 72, right: EDGE };
  const r = target.getBoundingClientRect();
  return { top: Math.max(EDGE, r.bottom + 8), right: Math.max(EDGE, window.innerWidth - r.right) };
}

function ToastCard({
  toast,
  onClose,
  onViewCart,
}: {
  toast: ToastData;
  onClose: () => void;
  onViewCart: () => void;
}) {
  const [pos, setPos] = useState(positionUnderCart);
  const [paused, setPaused] = useState(false);

  // Se va solo a los 3 s (salvo que el mouse o el foco estén encima).
  useEffect(() => {
    if (paused) return;
    const t = window.setTimeout(onClose, VISIBLE_MS);
    return () => window.clearTimeout(t);
  }, [paused, onClose]);

  // El encabezado es fijo, pero la barra de anuncios de arriba no: si se
  // hace scroll, el carrito se mueve un poco y el aviso lo acompaña.
  useEffect(() => {
    const update = () => setPos(positionUnderCart());
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return (
    <div
      style={{ top: pos.top, right: pos.right }}
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setPaused(false);
      }}
      className="fixed z-40 flex w-[min(20rem,calc(100vw-1.5rem))] animate-in items-center gap-3 rounded-2xl border bg-background p-3 shadow-[0_16px_40px_-16px_rgb(43_43_43/0.45)] duration-200 fade-in motion-safe:slide-in-from-top-2"
    >
      <div className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-muted">
        {toast.imageUrl && <Image src={toast.imageUrl} alt="" fill sizes="56px" className="object-cover" />}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="flex items-center gap-1 text-xs font-semibold text-brand">
          <Check aria-hidden className="size-3.5" strokeWidth={3} />
          {toast.title}
        </p>
        <p className="truncate text-sm font-medium text-foreground">{toast.name}</p>
        <button
          type="button"
          onClick={onViewCart}
          className="self-start rounded text-sm font-semibold text-foreground underline underline-offset-4 hover:text-brand focus-visible:ring-3 focus-visible:ring-ring/30 focus-visible:outline-none"
        >
          Ver carrito
        </button>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Cerrar aviso"
        className="-mt-6 -mr-1 inline-flex size-8 shrink-0 items-center justify-center self-start rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/30 focus-visible:outline-none"
      >
        <X aria-hidden className="size-4" />
      </button>
    </div>
  );
}
