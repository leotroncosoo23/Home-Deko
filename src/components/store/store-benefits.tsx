import Link from "next/link";
import { CreditCard, RefreshCcw, Store, Truck } from "lucide-react";
import { STORE_CONTAINER } from "@/lib/store-layout";
import { cn } from "@/lib/utils";

/**
 * Barra de beneficios, debajo del banner del inicio.
 * Celular: 2 × 2 (nada se corta). Desde tablet: 4 en una fila.
 * Sin cuotas ni marcas de medios de pago.
 */
const BENEFITS = [
  { icon: Truck, text: "Envíos a todo el país" },
  { icon: Store, text: "Retiro gratis en Trevelin" },
  { icon: CreditCard, text: "Pago seguro con tarjeta" },
  { icon: RefreshCcw, text: "Cambios y devoluciones", href: "/cambios-y-devoluciones" },
] as const;

export function StoreBenefits({ className }: { className?: string }) {
  return (
    <section aria-label="Beneficios de comprar en Home Deko" className={cn("border-b bg-background", className)}>
      <ul className={cn(STORE_CONTAINER, "grid grid-cols-2 gap-x-3 gap-y-4 py-5 md:grid-cols-4 md:gap-6 md:py-6")}>
        {BENEFITS.map((b) => {
          const content = (
            <>
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-soft md:size-10">
                <b.icon aria-hidden className="size-[18px] text-brand md:size-5" />
              </span>
              <span className="min-w-0 text-[13px] leading-snug font-semibold text-balance md:text-sm">{b.text}</span>
            </>
          );
          return (
            <li key={b.text} className="flex min-w-0 md:justify-center">
              {"href" in b ? (
                <Link
                  href={b.href}
                  className="flex min-w-0 items-center gap-2.5 rounded-lg underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/30"
                >
                  {content}
                </Link>
              ) : (
                <div className="flex min-w-0 items-center gap-2.5">{content}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
