import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ShoppingBag } from "lucide-react";
import { cn } from "cn";
import { HelpSheet } from "@/components/admin/help-sheet";
import { getNavItem } from "@/components/admin/nav-items";
import { PageHeader } from "@/components/admin/page-header";
import { SectionCard } from "@/components/admin/section-card";
import { Skeleton } from "@/components/ui/skeleton";
import { getOrders, ORDERS_LIMIT, type OrderFilter } from "./data";
import { OrdersTable } from "./_components/orders-table";

const section = getNavItem("/admin/pedidos");

export const metadata: Metadata = { title: "Pedidos" };

/**
 * /admin/pedidos — lista simple de los pedidos de la tienda con su estado.
 * Por defecto, los pagados (y los que hay que revisar); "Todos" suma los
 * intentos que quedaron sin pagar.
 */
export default function OrdersPage({ searchParams }: PageProps<"/admin/pedidos">) {
  return (
    <>
      <PageHeader
        eyebrow={section.group}
        title={section.title}
        description={section.description}
        actions={<HelpSheet guia="pedidos" />}
      />
      <Suspense fallback={<OrdersSkeleton />}>
        {searchParams.then((raw) => (
          <OrdersSection filter={raw.ver === "todos" ? "todos" : "pagados"} />
        ))}
      </Suspense>
    </>
  );
}

async function OrdersSection({ filter }: { filter: OrderFilter }) {
  const { items, total } = await getOrders(filter);

  return (
    <SectionCard
      icon={ShoppingBag}
      title="Pedidos de la tienda"
      description={
        filter === "pagados"
          ? "Los pedidos cobrados y los que hay que revisar, del más nuevo al más viejo."
          : "Todos los pedidos, también los que quedaron sin pagar."
      }
      contentClassName="p-0"
    >
      <nav aria-label="Filtrar pedidos" className="flex gap-2 border-b px-4 py-3">
        <FilterLink href="/admin/pedidos" active={filter === "pagados"}>
          Pagados
        </FilterLink>
        <FilterLink href="/admin/pedidos?ver=todos" active={filter === "todos"}>
          Todos
        </FilterLink>
      </nav>
      {items.length > 0 ? (
        <>
          <OrdersTable items={items} />
          {total > ORDERS_LIMIT && (
            <p className="border-t px-4 py-3 text-xs text-muted-foreground">
              Se muestran los últimos {ORDERS_LIMIT} de {total} pedidos.
            </p>
          )}
        </>
      ) : (
        <p className="px-4 py-10 text-center text-sm text-muted-foreground">
          {filter === "pagados"
            ? "Acá vas a ver los pedidos cuando los clientes compren en la tienda."
            : "Todavía no hay pedidos."}
        </p>
      )}
    </SectionCard>
  );
}

function FilterLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex h-8 items-center rounded-full border px-3.5 text-sm font-medium transition-colors",
        active ? "border-foreground bg-foreground text-background" : "hover:bg-muted",
      )}
    >
      {children}
    </Link>
  );
}

function OrdersSkeleton() {
  return (
    <SectionCard icon={ShoppingBag} title="Pedidos de la tienda" contentClassName="flex flex-col gap-3">
      {Array.from({ length: 5 }, (_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </SectionCard>
  );
}
