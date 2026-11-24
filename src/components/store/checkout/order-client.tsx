"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { replaceCart } from "../cart/cart-store";
import { shouldClearCartFor } from "./checkout-storage";

/**
 * Pago aprobado: vacía el carrito UNA vez por pedido (si el cliente recarga
 * la página después de agregar otra cosa, no se lo volvemos a vaciar).
 */
export function ClearCartOnApproved({ orderId }: { orderId: string }) {
  useEffect(() => {
    if (shouldClearCartFor(orderId)) replaceCart([]);
  }, [orderId]);
  return null;
}

/** Botón "Copiar" del código de seguimiento. */
export function CopyCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(code);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        } catch {
          // Sin permiso para copiar: el código igual se ve y se puede seleccionar.
        }
      }}
      className="inline-flex h-9 items-center rounded-full border px-4 text-sm font-semibold transition-colors hover:bg-muted"
    >
      {copied ? "¡Copiado!" : "Copiar código"}
    </button>
  );
}

const INTERVAL_MS = 5000;
const MAX_TRIES = 12; // ~1 minuto

/**
 * Pago todavía sin confirmar: el aviso de Mercado Pago (webhook) suele
 * llegar en segundos. Mientras tanto, se vuelve a pedir la página cada 5 s
 * durante ~1 minuto. Después, se deja de insistir y se muestra un texto.
 */
export function AutoRefresh() {
  const router = useRouter();
  const [tries, setTries] = useState(0);
  const done = tries >= MAX_TRIES;

  useEffect(() => {
    if (done) return;
    const t = window.setTimeout(() => {
      setTries((n) => n + 1);
      router.refresh();
    }, INTERVAL_MS);
    return () => window.clearTimeout(t);
  }, [tries, done, router]);

  if (!done) return null;
  return (
    <p className="text-sm text-muted-foreground">
      Si ya pagaste, la confirmación puede demorar unos minutos. Volvé a abrir esta página más tarde para ver el estado.
    </p>
  );
}
