import { cn } from "cn";
import { formatPrice } from "@/lib/format";
import type { Prices, PricingSettings } from "@/lib/pricing";

/**
 * Textos de precio que comparten la tarjeta, la página del producto y el carrito.
 *
 *   - "1 pago": solo cuando hay algo con qué compararlo (descuento en 1 pago o
 *     cuotas). Con 0 % y sin cuotas, la tienda se ve como siempre.
 *   - "Precio de lista": solo si es distinto del contado (descuento > 0).
 *   - "hasta N cuotas sin interés de $ X": solo con las cuotas prendidas.
 */
export function showCashTag(s: PricingSettings): boolean {
  return s.cashDiscountPercent > 0 || s.installmentsEnabled;
}

export function showListPrice(s: PricingSettings): boolean {
  return s.cashDiscountPercent > 0;
}

/** "hasta 6 cuotas sin interés de $ 1.666,67" (o null). */
export function installmentsText(prices: Pick<Prices, "cuotas" | "valorCuota">): string | null {
  if (!prices.cuotas || prices.valorCuota === null) return null;
  return `hasta ${prices.cuotas} cuotas sin interés de ${formatPrice(prices.valorCuota)}`;
}

/** Etiqueta chica al lado del precio contado. */
export function CashTag({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "rounded-full bg-muted px-1.5 py-0.5 text-[10px] leading-none font-semibold tracking-wide text-muted-foreground uppercase md:text-[11px]",
        className,
      )}
    >
      1 pago
    </span>
  );
}

/** Debajo del precio contado, chico y en gris: lista y cuotas. */
export function ListAndInstallments({
  prices,
  pricing,
  className,
}: {
  prices: Prices;
  pricing: PricingSettings;
  className?: string;
}) {
  const list = showListPrice(pricing);
  const cuotas = installmentsText(prices);
  if (!list && !cuotas) return null;
  return (
    <div className={cn("flex flex-col gap-0.5 text-xs leading-snug text-muted-foreground tabular-nums", className)}>
      {list && <p>Precio de lista {formatPrice(prices.lista)}</p>}
      {cuotas && <p>{cuotas}</p>}
    </div>
  );
}
