import { AlertTriangle } from "lucide-react";
import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
import { formatARS } from "@/lib/format";
import { formatMovementDate } from "../../stock/_components/movements-table";
import type { OrderRow } from "../data";
import { DELIVERY_LABELS, FULFILLMENT_LABELS, PAYMENT_LABELS, PAYMENT_STYLES } from "../status";

/**
 * Lista de pedidos: en PC una tabla, en el celular una tarjeta por pedido.
 * Arriba de cada estado, los avisos que requieren acción de los dueños.
 */

const GRID = "md:grid-cols-[4.5rem_8.5rem_minmax(0,1.3fr)_minmax(0,1fr)_7rem_minmax(0,1.2fr)]";

export function OrdersTable({ items }: { items: OrderRow[] }) {
  return (
    <div className="text-sm">
      <div className={cn("hidden gap-3 border-b bg-muted/60 px-4 py-2 text-xs font-medium text-muted-foreground md:grid", GRID)}>
        <span>N.º</span>
        <span>Fecha</span>
        <span>Cliente</span>
        <span>Entrega</span>
        <span className="text-right">Total</span>
        <span>Estado</span>
      </div>
      <ul className="divide-y">
        {items.map((o) => {
          const number = <span className="font-semibold tabular-nums">#{o.number}</span>;
          const customer = (
            <span className="flex min-w-0 flex-col">
              <span className="truncate font-medium">{o.customerName}</span>
              <span className="truncate text-xs text-muted-foreground">
                {o.customerEmail} · {o.customerPhone}
              </span>
            </span>
          );
          const delivery = (
            <span className="flex min-w-0 flex-col">
              <span className="truncate">{DELIVERY_LABELS[o.delivery]}</span>
              {o.place && <span className="truncate text-xs text-muted-foreground">{o.place}</span>}
            </span>
          );
          const total = <span className="font-semibold tabular-nums">{formatARS(o.total)}</span>;
          const status = <OrderStatus order={o} />;

          return (
            <li key={o.id}>
              {/* PC */}
              <div className={cn("hidden items-start gap-3 px-4 py-3 md:grid", GRID)}>
                {number}
                <span className="text-xs text-muted-foreground tabular-nums">{formatMovementDate(o.createdAt)}</span>
                {customer}
                {delivery}
                <span className="text-right">{total}</span>
                {status}
              </div>
              {/* Celular */}
              <div className="flex flex-col gap-2 px-4 py-3 md:hidden">
                <div className="flex items-start justify-between gap-3">
                  <span className="flex flex-col">
                    {number}
                    <span className="text-xs text-muted-foreground tabular-nums">{formatMovementDate(o.createdAt)}</span>
                  </span>
                  {total}
                </div>
                {customer}
                {delivery}
                {status}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function OrderStatus({ order }: { order: OrderRow }) {
  return (
    <span className="flex min-w-0 flex-col items-start gap-1.5">
      <span className="flex flex-wrap gap-1.5">
        <Badge className={PAYMENT_STYLES[order.paymentStatus]}>Pago {PAYMENT_LABELS[order.paymentStatus].toLowerCase()}</Badge>
        {order.paymentStatus === "approved" && !order.stockIssue && (
          <Badge className="bg-secondary text-foreground">{FULFILLMENT_LABELS[order.fulfillmentStatus]}</Badge>
        )}
      </span>
      {order.stockIssue && order.paymentStatus === "approved" && (
        <Badge className="h-auto bg-brand-soft py-0.5 whitespace-normal text-brand">
          <AlertTriangle aria-hidden />
          Pagado sin stock: devolvé el dinero u ofrecé otro producto
        </Badge>
      )}
      {order.needsReview && (
        <span className="flex flex-col gap-1">
          <Badge className="bg-amber-50 text-amber-800">
            <AlertTriangle aria-hidden />
            Para revisar
          </Badge>
          {order.reviewReason && <span className="text-xs text-muted-foreground">{order.reviewReason}</span>}
        </span>
      )}
    </span>
  );
}
