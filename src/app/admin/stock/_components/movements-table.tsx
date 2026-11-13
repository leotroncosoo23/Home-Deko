import Link from "next/link";
import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
import { REASON_LABELS, REASON_STYLES } from "../reasons";
import type { Movement } from "../types";

/**
 * Tabla de movimientos de stock (historial). En PC una tabla, en el
 * celular una tarjeta por movimiento. La usan /admin/stock y la edición
 * de un producto (ahí sin la columna "Producto").
 */

const dateFormat = new Intl.DateTimeFormat("es-AR", {
  timeZone: "America/Argentina/Buenos_Aires",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatMovementDate(iso: string): string {
  return dateFormat.format(new Date(iso)).replace(",", "");
}

export function MovementsTable({ items, showProduct = true }: { items: Movement[]; showProduct?: boolean }) {
  const grid = showProduct
    ? "md:grid-cols-[8.5rem_minmax(0,1.4fr)_9.5rem_4.5rem_4.5rem_minmax(0,1fr)]"
    : "md:grid-cols-[8.5rem_minmax(0,1fr)_9.5rem_4.5rem_4.5rem_minmax(0,1fr)]";

  return (
    <div className="text-sm">
      <div className={cn("hidden gap-3 border-b bg-muted/60 px-4 py-2 text-xs font-medium text-muted-foreground md:grid", grid)}>
        <span>Fecha</span>
        <span>{showProduct ? "Producto" : "Variante"}</span>
        <span>Motivo</span>
        <span className="text-right">Cantidad</span>
        <span className="text-right">Quedó</span>
        <span>Quién · nota</span>
      </div>
      <ul className="divide-y">
        {items.map((m) => {
          const what = showProduct ? (
            <span className="flex min-w-0 flex-col">
              <Link href={`/admin/productos/${m.productId}`} className="truncate font-medium hover:underline">
                {m.productName}
              </Link>
              {m.variantLabel && <span className="truncate text-xs text-muted-foreground">{m.variantLabel}</span>}
            </span>
          ) : (
            <span className="truncate">{m.variantLabel ?? "Única"}</span>
          );
          const qty = (
            <span className={cn("font-semibold tabular-nums", m.quantity > 0 ? "text-emerald-700" : "text-foreground")}>
              {m.quantity > 0 ? `+${m.quantity}` : `−${Math.abs(m.quantity)}`}
            </span>
          );
          const who = (
            <span className="min-w-0 text-xs text-muted-foreground">
              <span className="text-foreground/80">{m.authorName ?? "Sistema"}</span>
              {m.note && <span className="block truncate md:inline md:before:content-['_·_']" title={m.note}>{m.note}</span>}
            </span>
          );

          return (
            <li key={m.id}>
              {/* PC */}
              <div className={cn("hidden items-center gap-3 px-4 py-2.5 md:grid", grid)}>
                <span className="text-xs text-muted-foreground tabular-nums">{formatMovementDate(m.createdAt)}</span>
                {what}
                <span>
                  <Badge className={REASON_STYLES[m.reason]}>{REASON_LABELS[m.reason]}</Badge>
                </span>
                <span className="text-right">{qty}</span>
                <span className="text-right tabular-nums">{m.stockAfter}</span>
                {who}
              </div>
              {/* Celular */}
              <div className="flex flex-col gap-1.5 px-4 py-3 md:hidden">
                <div className="flex items-start justify-between gap-3">
                  {what}
                  <span className="shrink-0 text-right">
                    {qty}
                    <span className="block text-xs text-muted-foreground tabular-nums">quedó {m.stockAfter}</span>
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={REASON_STYLES[m.reason]}>{REASON_LABELS[m.reason]}</Badge>
                  <span className="text-xs text-muted-foreground tabular-nums">{formatMovementDate(m.createdAt)}</span>
                </div>
                {who}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
