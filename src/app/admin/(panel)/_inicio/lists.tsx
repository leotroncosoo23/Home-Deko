import Link from "next/link";
import { ArrowRight, ChevronRight, Inbox, Trophy } from "lucide-react";
import { cn } from "cn";
import { SectionCard } from "@/components/admin/section-card";
import { OrderStatus } from "../pedidos/_components/orders-table";
import { formatOrderDate } from "../pedidos/status";
import type { Dashboard, LatestOrder } from "./data";
import { EmptyState, money, Thumb } from "./ui";

/** "Más vendidos" (del período) y "Últimos pedidos" (siempre los 5 más nuevos). */

const unidades = (n: number) => (n === 1 ? "1 unidad" : `${n.toLocaleString("es-AR")} unidades`);

export function TopProducts({ data }: { data: Dashboard }) {
  return (
    <SectionCard icon={Trophy} title="Más vendidos" description="Unidades y plata de cada producto en el período." contentClassName="p-0">
      {data.topProducts.length === 0 ? (
        <EmptyState icon={Trophy} title="Todavía no hay ventas en este período">
          Cuando se vendan productos, vas a ver acá los que más salen.
        </EmptyState>
      ) : (
        <ol className="divide-y">
          {data.topProducts.map((p, i) => {
            const content = (
              <>
                <span className="w-4 shrink-0 text-center text-xs font-semibold text-muted-foreground tabular-nums">{i + 1}</span>
                <Thumb path={p.imagePath} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-medium">{p.name}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">{unidades(p.units)}</span>
                </span>
                <span className="font-semibold tabular-nums">{money(p.revenue)}</span>
              </>
            );
            return (
              <li key={p.productId ?? p.name}>
                {p.productId ? (
                  <Link
                    href={`/admin/productos/${p.productId}`}
                    className="flex items-center gap-3 px-5 py-2.5 text-sm transition-colors outline-none hover:bg-muted/40 focus-visible:bg-muted/60"
                  >
                    {content}
                  </Link>
                ) : (
                  // El producto ya no existe: se muestra con el nombre que tenía, sin link
                  <div className="flex items-center gap-3 px-5 py-2.5 text-sm">{content}</div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </SectionCard>
  );
}

export function LatestOrders({ orders }: { orders: LatestOrder[] }) {
  return (
    <SectionCard
      icon={Inbox}
      title="Últimos pedidos"
      description="Los 5 más nuevos, con su estado."
      contentClassName="p-0"
      action={
        orders.length > 0 ? (
          <Link
            href="/admin/pedidos?estado=todos"
            className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Ver todos
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        ) : null
      }
    >
      {orders.length === 0 ? (
        <EmptyState icon={Inbox} title="Todavía no hay pedidos">
          Cuando entre el primero, lo vas a ver acá con su estado.
        </EmptyState>
      ) : (
        <ul className="divide-y">
          {orders.map((o) => (
            <li key={o.id}>
              <Link
                href={`/admin/pedidos/${o.id}`}
                className="flex items-center gap-3 px-5 py-2.5 text-sm transition-colors outline-none hover:bg-muted/40 focus-visible:bg-muted/60"
              >
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="flex items-baseline gap-2">
                    <span className="font-semibold tabular-nums">#{o.number}</span>
                    <span className="truncate">{o.customerName}</span>
                  </span>
                  <OrderStatus order={o} />
                </span>
                <span className="flex flex-col items-end gap-0.5">
                  <span className={cn("font-semibold tabular-nums", o.fulfillmentStatus === "cancelled" && "text-muted-foreground line-through")}>
                    {money(o.total)}
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums">{formatOrderDate(o.createdAt)}</span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
