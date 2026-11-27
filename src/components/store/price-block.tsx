import { cn } from "cn";
import { formatPrice } from "@/lib/format";
import { DEFAULT_PRICING, getPrices, type Prices, type PricingSettings } from "@/lib/pricing";

/**
 * EL BLOQUE DE PRECIO de la tienda. Uno solo para todo, con los números de
 * getPrices() (src/lib/pricing.ts):
 *
 *   card     tarjeta de producto (catálogo, inicio, relacionados, búsqueda)
 *              $ 34.200  ̶$̶ ̶3̶8̶.̶0̶0̶0̶
 *              Precio de lista $ 47.120
 *              Hasta 12 cuotas sin interés de $ 3.926,67
 *   product  página del producto: lo mismo, más grande, con "-10% OFF" (badge)
 *   cart     línea del carrito / resumen del checkout: contado × cantidad y,
 *            si hay oferta, el tachado debajo. Sin segunda línea.
 *   total    debajo del total: "o hasta 6 cuotas sin interés de $ 9.920"
 *
 * Debajo del precio (card y product), chico y gris:
 *   - recargo > 0 → "Precio de lista $ {lista}"
 *   - cuotas prendidas → además, en su propio renglón,
 *     "Hasta {N} cuotas sin interés de $ {cuota}" (la cuota es lista / N)
 *   - recargo 0 y cuotas apagadas → nada
 * "Hasta": N es el máximo global de Configuración (el banco puede ofrecer menos).
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
    return <SecondLine prices={prices} pricing={pricing} total className={cn("text-xs leading-snug", className)} />;
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
    // Tarjeta: 2 px entre el precio y la línea de lista (gap-0.5), compacta.
    <div className={cn("flex min-w-0 flex-col", product ? "gap-1.5" : "gap-0.5", className)}>
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
      <SecondLine
        prices={prices}
        pricing={pricing}
        className={product ? "text-sm leading-snug" : "text-xs leading-tight"}
      />
    </div>
  );
}

/**
 * Debajo del precio: "Precio de lista $ 47.120" y/o "Hasta 12 cuotas sin interés
 * de $ 3.926,67" (un renglón cada uno), o nada. Debajo de un total: solo
 * "o hasta 6 cuotas sin interés de $ 9.920".
 */
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
  // El interlineado lo pone quien llama (tarjeta: leading-tight, compacto).
  const base = cn("text-muted-foreground tabular-nums", className);
  const amount = (n: number) => (
    <span className="font-semibold whitespace-nowrap text-foreground/70">{formatPrice(n)}</span>
  );

  const installments =
    prices.cuotas && prices.valorCuota !== null ? (
      // Dos bloques que no se parten: si no entra en un renglón (tarjeta angosta
      // del celular), corta entre "Hasta 12 cuotas" y "sin interés de $ …",
      // y nunca dentro de un número.
      <>
        <span className="whitespace-nowrap">
          {total ? "o hasta" : "Hasta"} {prices.cuotas} cuotas
        </span>{" "}
        <span className="whitespace-nowrap">sin interés de {formatPrice(prices.valorCuota)}</span>
      </>
    ) : null;

  if (total) return installments && <p className={base}>{installments}</p>;

  const list = pricing.listSurchargePercent > 0 ? <>Precio de lista {amount(prices.lista)}</> : null;
  if (!list && !installments) return null;
  return (
    <div className={base}>
      {list && <p>{list}</p>}
      {installments && <p>{installments}</p>}
    </div>
  );
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
