import { Receipt, ShoppingBag, TicketPercent, Wallet, type LucideIcon } from "lucide-react";
import { cn } from "cn";
import { changeBetween, type Change, type Period } from "@/lib/dashboard-period";
import type { Dashboard } from "./data";
import { ChangeLabel, money } from "./ui";

/**
 * Las 4 tarjetas: ventas ($, con envío), pedidos, ticket promedio y descuentos
 * por cupones. Cada una con su variación contra el período anterior.
 * En cero: el número en gris suave y sin flechas (se ve tranquilo, no "roto").
 */
export function StatCards({ data, period }: { data: Dashboard; period: Period }) {
  const { current: c, previous: p } = data;
  const avg = (t: typeof c) => (t.orders > 0 ? t.sales / t.orders : 0);

  return (
    <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Stat
        icon={Wallet}
        label="Ventas"
        value={money(c.sales)}
        empty={c.sales === 0}
        note={c.shipping > 0 ? `incluye ${money(c.shipping)} de envíos` : null}
        change={changeBetween(c.sales, p.sales)}
        compareLabel={period.compareLabel}
      />
      <Stat
        icon={ShoppingBag}
        label="Pedidos"
        value={c.orders.toLocaleString("es-AR")}
        empty={c.orders === 0}
        change={changeBetween(c.orders, p.orders)}
        compareLabel={period.compareLabel}
      />
      <Stat
        icon={Receipt}
        label="Ticket promedio"
        value={c.orders > 0 ? money(avg(c)) : "—"}
        empty={c.orders === 0}
        note={c.orders > 0 ? "lo que deja cada pedido, en promedio" : null}
        change={c.orders > 0 && p.orders > 0 ? changeBetween(avg(c), avg(p)) : { kind: "none" }}
        compareLabel={period.compareLabel}
      />
      <Stat
        icon={TicketPercent}
        label="Descuentos por cupones"
        value={money(c.discounts)}
        empty={c.discounts === 0}
        change={changeBetween(c.discounts, p.discounts)}
        compareLabel={period.compareLabel}
        neutral
      />
    </ul>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  empty,
  note,
  change,
  compareLabel,
  neutral,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  empty: boolean;
  note?: string | null;
  change: Change;
  compareLabel: string;
  neutral?: boolean;
}) {
  return (
    <li className="flex flex-col gap-1.5 surface-card p-4">
      <span className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="size-4 text-brand" aria-hidden />
        {label}
      </span>
      <span className={cn("text-2xl font-semibold tracking-tight tabular-nums", empty && "text-muted-foreground/70")}>
        {value}
      </span>
      {note && <span className="text-xs text-muted-foreground">{note}</span>}
      <ChangeLabel change={change} compareLabel={compareLabel} neutral={neutral} />
    </li>
  );
}
