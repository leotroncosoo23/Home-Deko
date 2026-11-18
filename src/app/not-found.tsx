import type { Metadata } from "next";
import Link from "next/link";
import { SearchX } from "lucide-react";
import { StoreFrame } from "@/components/store/store-frame";
import { ALL_PRODUCTS_LINK } from "@/lib/store-nav";

export const metadata: Metadata = { title: "No encontramos esta página" };

/**
 * Página 404 de todo el sitio (link viejo, dirección mal escrita o un
 * producto que ya no está). Va con el marco de la tienda: encabezado,
 * pie y WhatsApp, así el cliente sigue navegando.
 */
export default function NotFound() {
  return (
    <StoreFrame>
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-5 px-4 py-20 text-center">
        <span className="flex size-16 items-center justify-center rounded-full bg-brand-soft text-brand">
          <SearchX aria-hidden className="size-7" />
        </span>
        <h1 className="font-display text-3xl leading-tight font-semibold md:text-4xl">
          No encontramos esta página
        </h1>
        <p className="text-[17px] leading-7 text-muted-foreground">
          Puede que el link haya cambiado o que lo que buscabas ya no esté. Te invitamos a seguir
          recorriendo la tienda.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link
            href={ALL_PRODUCTS_LINK.href}
            className="inline-flex h-11 items-center justify-center rounded-full bg-brand px-6 font-semibold text-white transition-colors hover:bg-brand-hover focus-visible:ring-4 focus-visible:ring-brand/30 focus-visible:outline-none"
          >
            Ver productos
          </Link>
          <Link
            href="/"
            className="inline-flex h-11 items-center justify-center rounded-full border px-6 font-semibold transition-colors hover:bg-muted focus-visible:ring-4 focus-visible:ring-ring/20 focus-visible:outline-none"
          >
            Ir al inicio
          </Link>
        </div>
      </main>
    </StoreFrame>
  );
}
