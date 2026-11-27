import { cn } from "cn";
import { formatPrice } from "@/lib/format";
import { DEFAULT_PRICING, getPrices, type Prices, type PricingSettings } from "@/lib/pricing";

/**
 * EL BLOQUE DE PRECIO de la tienda. Uno solo para todo, con los números de
 * getPrices() (src/lib/pricing.ts):
 *
 *   card     tarjeta de producto (catálogo, inicio, relacionados, búsqueda)
 *              $ 34.200  ̶$̶ ̶3̶8̶.̶0̶0̶0̶
 *              $ 47.120 en 12 cuotas sin interés de $ 3.926,67
 *   product  página del producto: lo mismo, más grande, con "-10% OFF" (badge)
 *   cart     línea del carrito / resumen del checkout: contado × cantidad y,
 *            si hay oferta, el tachado debajo. Sin segunda línea.
 *   total    debajo del total: "o $ 59.520 en 6 cuotas sin interés de $ 9.920"
 *
 * Segunda línea (card, product y total):
 *   - cuotas prendidas → "$ {lista} en {N} cuotas sin interés de $ {cuota}"
 *   - cuotas apagadas y recargo > 0 → "Precio de lista $ {lista}" (no en total)
 *   - recargo 0 y cuotas apagadas → nada
 * Con un máximo de cuotas global se dice "12 cuotas" a secas (sin "hasta").
 * Los montos nunca se cortan por la mitad (whitespace-nowrap).
 */
export type PriceBlockVariant = "card" | "product" | "cart" | "total";

export function PriceBlock({
  prices,
  pricing = DEFAULT_PRICING,
  variant,
  qty = 1,
  from = false,
  badge,
  className,
}: {
  prices: Prices;
  /** Recargo y cuotas (para la segunda línea; "cart" no la usa). */
  pricing?: PricingSettings;
  variant: PriceBlockVariant;
  /** Solo "cart": se muestra el precio por la cantidad. */
  qty?: number;
  /** "Desde" delante (variantes con distinto precio). */
  from?: boolean;
  /** Solo "product": la etiqueta "-10% OFF" al lado del tachado. */
  badge?: React.ReactNode;
  className?: string;
}) {
  if (variant === "total") {
    return <SecondLine prices={prices} pricing={pricing} total className={cn("text-xs", className)} />;
  }

  if (variant === "cart") {
    return (
      <p className={cn("flex flex-col items-end whitespace-nowrap tabular-nums", className)}>
        <span className={cn("font-semibold", prices.oferta && "text-brand")}>{formatPrice(prices.contado * qty)}</span>
        {prices.oferta && (
          <span className="text-xs text-muted-foreground line-through">
            <span className="sr-only">Antes: </span>
            {formatPrice(prices.contadoSinOferta * qty)}
          </span>
        )}
      </p>
    );
  }

  const product = variant === "product";
  return (
    <div className={cn("flex min-w-0 flex-col", product ? "gap-1.5" : "gap-1", className)}>
      <p
        className={cn(
          "flex min-w-0 flex-wrap items-baseline tabular-nums",
          product ? "gap-x-3 gap-y-1" : "gap-x-2 gap-y-0.5",
        )}
      >
        {from && <span className={cn("text-muted-foreground", product ? "text-sm" : "text-xs")}>Desde</span>}
        <span
          className={cn(
            "font-bold tracking-tight whitespace-nowrap",
            product ? "text-[30px] leading-none md:text-[34px]" : "text-[17px] leading-tight md:text-xl",
            prices.oferta ? "text-brand" : "text-foreground",
          )}
        >
          {formatPrice(prices.contado)}
        </span>
        {prices.oferta && (
          <span
            className={cn(
              "whitespace-nowrap text-muted-foreground line-through",
              product ? "text-base md:text-lg" : "text-[13px] md:text-sm",
            )}
          >
            <span className="sr-only">Antes: </span>
            {formatPrice(prices.contadoSinOferta)}
          </span>
        )}
        {product && prices.oferta && badge}
      </p>
      <SecondLine prices={prices} pricing={pricing} className={product ? "text-sm" : "text-xs"} />
    </div>
  );
}

/** "$ 47.120 en 12 cuotas sin interés de $ 3.926,67" / "Precio de lista $ 47.120" / nada. */
function SecondLine({
  prices,
  pricing,
  total = false,
  className,
}: {
  prices: Prices;
  pricing: PricingSettings;
  /** Debajo de un total: "o $ … en N cuotas …" y nunca "Precio de lista". */
  total?: boolean;
  className?: string;
}) {
  const base = cn("leading-snug text-muted-foreground tabular-nums", className);
  const amount = (n: number) => (
    <span className="font-semibold whitespace-nowrap text-foreground/70">{formatPrice(n)}</span>
  );

  if (prices.cuotas && prices.valorCuota !== null) {
    return (
      // Dos bloques que no se parten: si no entra en una línea, corta entre
      // "… en 12 cuotas" y "sin interés de $ …" (y nunca dentro de un número).
      <p className={base}>
        <span className="whitespace-nowrap">
          {total && "o "}
          {amount(prices.lista)} en {prices.cuotas} cuotas
        </span>{" "}
        <span className="whitespace-nowrap">sin interés de {formatPrice(prices.valorCuota)}</span>
      </p>
    );
  }
  if (!total && pricing.listSurchargePercent > 0) {
    return <p className={base}>Precio de lista {amount(prices.lista)}</p>;
  }
  return null;
}

/** Una línea del carrito (unitPrice = contado, unitPriceBefore = sin oferta) para <PriceBlock variant="cart">. */
export function linePrices(line: { unitPrice: number; unitPriceBefore: number | null }): Prices {
  return getPrices({ price: line.unitPriceBefore ?? line.unitPrice, finalPrice: line.unitPrice }, DEFAULT_PRICING);
}

/** Un total (carrito, checkout) en la forma que espera <PriceBlock variant="total">. */
export function totalPrices(t: { contado: number; lista: number; cuotas: number | null; valorCuota: number | null }): Prices {
  return {
    lista: t.lista,
    contadoSinOferta: t.contado,
    contado: t.contado,
    oferta: false,
    ofertaPercent: null,
    cuotas: t.cuotas,
    valorCuota: t.valorCuota,
  };
}
