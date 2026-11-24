import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
import { formatARS } from "@/lib/format";
import type { ProductListItem } from "../types";

/**
 * Celdas del listado de productos.
 * Colores de estado del CLAUDE.md: ámbar = stock bajo, rojo de marca = sin stock.
 */

export function StockBadge({ status }: { status: ProductListItem["stockStatus"] }) {
  if (status === "out") return <Badge className="bg-brand-soft text-brand">Sin stock</Badge>;
  if (status === "low") return <Badge className="bg-amber-50 text-amber-800">Stock bajo</Badge>;
  return null;
}

/** "12" + badge si hace falta. */
export function StockCell({ item, className }: { item: ProductListItem; className?: string }) {
  return (
    <span className={cn("flex flex-wrap items-center gap-1.5", className)}>
      <span className={cn("tabular-nums", item.stockStatus === "out" && "text-muted-foreground")}>{item.totalStock}</span>
      <StockBadge status={item.stockStatus} />
    </span>
  );
}

/**
 * Precio: "$ 10.000"; con descuento vigente, tachado + final;
 * si las variantes tienen precios distintos, "desde $ X".
 */
export function PriceCell({ item, className }: { item: ProductListItem; className?: string }) {
  const range = item.minPrice !== item.maxPrice;
  return (
    <span className={cn("flex flex-col tabular-nums", className)}>
      {item.discountActive ? (
        <>
          <span className="text-xs text-muted-foreground line-through">
            {range && "desde "}
            {formatARS(item.minPrice)}
          </span>
          <span className="font-medium">
            {range && <span className="font-normal text-muted-foreground">desde </span>}
            {formatARS(item.finalMinPrice)}
          </span>
        </>
      ) : (
        <span>
          {range && <span className="text-muted-foreground">desde </span>}
          {formatARS(item.minPrice)}
        </span>
      )}
    </span>
  );
}

/** "Única" o "4 variantes". */
export function variantsText(item: ProductListItem): string {
  if (!item.hasVariants) return "Única";
  return item.variantCount === 1 ? "1 variante" : `${item.variantCount} variantes`;
}
