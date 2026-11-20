"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CreditCard } from "lucide-react";
import { getCartLines } from "@/app/(tienda)/actions";
import { formatARS } from "@/lib/format";
import { ALL_PRODUCTS_LINK } from "@/lib/store-nav";
import { WhatsAppIcon } from "../whatsapp-icon";
import { useCart } from "./cart-provider";
import { getCartSnapshot } from "./cart-store";

/**
 * Contenido de /finalizar-compra mientras no está el pago online (paso 4):
 * un mensaje para el cliente y un botón para terminar la compra por
 * WhatsApp con el pedido ya escrito (con los precios reales del servidor).
 */
export function CheckoutSoon({ whatsapp }: { whatsapp: string }) {
  const { items } = useCart();
  const [message, setMessage] = useState<string | null>(null);
  const idsKey = items.map((i) => `${i.variantId}:${i.qty}`).join(",");

  useEffect(() => {
    if (!idsKey) return;
    let cancelled = false;
    getCartLines(getCartSnapshot())
      .then((data) => {
        if (cancelled) return;
        const lines = data.lines.filter((l) => l.status !== "unavailable" && l.name);
        if (lines.length === 0) return setMessage(null);
        const detail = lines
          .map((l) => `• ${l.qty} × ${l.name}${l.variantLabel ? ` (${l.variantLabel})` : ""}: ${formatARS(l.unitPrice * l.qty)}`)
          .join("\n");
        const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
        setMessage(`Hola Home Deko, quiero comprar:\n${detail}\nSubtotal: ${formatARS(subtotal)}`);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [idsKey]);

  const text = (idsKey && message) || "Hola Home Deko, quiero hacer un pedido.";
  const href = whatsapp ? `https://wa.me/${whatsapp}?text=${encodeURIComponent(text)}` : null;

  return (
    <div className="flex max-w-lg flex-col items-center gap-5 text-center">
      <span className="flex size-16 items-center justify-center rounded-full bg-brand-soft text-brand">
        <CreditCard aria-hidden className="size-7" />
      </span>
      <h1 className="font-display text-3xl leading-tight font-semibold tracking-tight md:text-4xl">
        Muy pronto, el pago online
      </h1>
      <p className="text-[15px] leading-7 text-muted-foreground md:text-base">
        Estamos terminando de preparar el pago con Mercado Pago. Mientras tanto, escribinos por WhatsApp y te
        ayudamos a completar tu compra. Tu carrito queda guardado.
      </p>
      <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
        {href && (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[#25D366] px-6 font-semibold text-white transition-opacity hover:opacity-90 focus-visible:ring-4 focus-visible:ring-[#25D366]/40 focus-visible:outline-none"
          >
            <WhatsAppIcon className="size-5" />
            {idsKey ? "Enviar mi pedido por WhatsApp" : "Escribinos por WhatsApp"}
            <span className="sr-only"> (se abre en otra pestaña)</span>
          </a>
        )}
        <Link
          href={ALL_PRODUCTS_LINK.href}
          className="inline-flex h-12 items-center justify-center rounded-full border px-6 font-semibold transition-colors hover:bg-muted"
        >
          Seguir comprando
        </Link>
      </div>
    </div>
  );
}
