"use client";

import Link from "next/link";
import { AlertTriangle, ChevronRight, Store, Truck } from "lucide-react";
import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { formatARS } from "@/lib/format";
import type { OrderRow } from "../data";
import { formatOrderDate, FULFILLMENT_LABELS, FULFILLMENT_STYLES, PAYMENT_LABELS, PAYMENT_STYLES } from "../status";

/**
 * Lista de pedidos: en PC una tabla, en el celular una tarjeta por pedido.
 * Cada fila tiene su casilla (para imprimir o cambiar varios a la vez) y
 * lleva al detalle del pedido.
 */

const GRID = "md:grid-cols-[1.25rem_4.5rem_7.5rem_minmax(0,1.3fr)_minmax(0,1fr)_7rem_minmax(0,1.2fr)_1rem]";

export function OrdersTable({
  items,
  selected,
  onToggle,
  onToggleAll,
}: {
  items: OrderRow[];
  selected: Set<string>;
  onToggle: (id: string, checked: boolean) => void;
  onToggleAll: (checked: boolean) => void;
}) {
  const selectedHere = items.filter((i) => selected.has(i.id)).length;
  const allChecked = selectedHere > 0 && selectedHere === items.length;

  return (
    <div className="text-sm">
      <div className={cn("hidden items-center gap-3 border-b bg-muted/60 px-4 py-2 text-xs font-medium text-muted-foreground md:grid", GRID)}>
        <Checkbox
          checked={allChecked}
          indeterminate={selectedHere > 0 && !allChecked}
          onCheckedChange={(c) => onToggleAll(Boolean(c))}
          aria-label="Seleccionar todos los pedidos de la lista"
        />
        <span>N.º</span>
        <span>Fecha</span>
        <span>Cliente</span>
        <span>Entrega</span>
        <span className="text-right">Total</span>
        <span>Estado</span>
        <span />
      </div>
      {/* Celular: "seleccionar todos" arriba de las tarjetas */}
      <label className="flex items-center gap-3 border-b bg-muted/60 px-4 py-2 text-xs font-medium text-muted-foreground md:hidden">
        <Checkbox
          checked={allChecked}
          indeterminate={selectedHere > 0 && !allChecked}
          onCheckedChange={(c) => onToggleAll(Boolean(c))}
        />
        Seleccionar todos
      </label>

      <ul className="divide-y">
        {items.map((o) => {
          const href = `/admin/pedidos/${o.id}`;
          const isSelected = selected.has(o.id);
          const checkbox = (
            <Checkbox
              checked={isSelected}
              onCheckedChange={(c) => onToggle(o.id, Boolean(c))}
              aria-label={`Seleccionar el pedido #${o.number}`}
              className="relative z-10"
            />
          );
          const number = (
            <Link href={href} className="font-semibold tabular-nums outline-none after:absolute after:inset-0 focus-visible:underline">
              #{o.number}
            </Link>
          );
          const customer = (
            <span className="flex min-w-0 flex-col">
              <span className="truncate font-medium">{o.customerName}</span>
              <span className="truncate text-xs text-muted-foreground">
                {o.units === 1 ? "1 producto" : `${o.units} productos`}
              </span>
            </span>
          );
          const delivery = (
            <span className="flex min-w-0 items-start gap-1.5">
              {o.delivery === "shipping" ? (
                <Truck className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
              ) : (
                <Store className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
              )}
              <span className="flex min-w-0 flex-col">
                <span className="truncate">{o.delivery === "shipping" ? o.place : "Retiro en el local"}</span>
                {o.tracking && (
                  <span className="truncate text-xs text-muted-foreground">
                    {o.tracking.carrierLabel} · {o.tracking.code}
                  </span>
                )}
              </span>
            </span>
          );
          const total = <span className="font-semibold tabular-nums">{formatARS(o.total)}</span>;
          const status = <OrderStatus order={o} />;
          const date = <span className="text-xs text-muted-foreground tabular-nums">{formatOrderDate(o.createdAt)}</span>;

          return (
            <li key={o.id} className={cn("relative transition-colors hover:bg-muted/40", isSelected && "bg-muted/60")}>
              {/* PC */}
              <div className={cn("hidden items-center gap-3 px-4 py-3 md:grid", GRID)}>
                {checkbox}
                {number}
                {date}
                {customer}
                {delivery}
                <span className="text-right">{total}</span>
                {status}
                <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
              </div>
              {/* Celular */}
              <div className="flex gap-3 px-4 py-3 md:hidden">
                <div className="pt-0.5">{checkbox}</div>
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <div className="flex items-start justify-between gap-3">
                    <span className="flex flex-col">
                      {number}
                      {date}
                    </span>
                    {total}
                  </div>
                  {customer}
                  {delivery}
                  {status}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function OrderStatus({ order }: { order: Pick<OrderRow, "paymentStatus" | "fulfillmentStatus" | "stockIssue" | "needsReview"> }) {
  const showFulfillment = order.paymentStatus === "approved" || order.fulfillmentStatus === "cancelled";
  return (
    <span className="flex min-w-0 flex-wrap items-start gap-1.5">
      {showFulfillment ? (
        <Badge className={FULFILLMENT_STYLES[order.fulfillmentStatus]}>{FULFILLMENT_LABELS[order.fulfillmentStatus]}</Badge>
      ) : (
        <Badge className={PAYMENT_STYLES[order.paymentStatus]}>Pago {PAYMENT_LABELS[order.paymentStatus].toLowerCase()}</Badge>
      )}
      {order.stockIssue && order.fulfillmentStatus !== "cancelled" && (
        <Badge className="bg-brand-soft text-brand">
          <AlertTriangle aria-hidden />
          Pagado sin stock
        </Badge>
      )}
      {order.needsReview && (
        <Badge className="bg-amber-50 text-amber-800">
          <AlertTriangle aria-hidden />
          Para revisar
        </Badge>
      )}
    </span>
  );
}
