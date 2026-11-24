import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AlertTriangle, Mail, PackageX } from "lucide-react";
import { HelpSheet } from "@/components/admin/help-sheet";
import { getNavItem } from "@/components/admin/nav-items";
import { PageHeader } from "@/components/admin/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getStoreSettings, ownersEmail } from "@/lib/store-settings";
import { cn } from "@/lib/utils";
import { getOrderCounts, getOrders, type OrderCounts } from "./data";
import { parseListParams, type ListParams } from "./list-params";
import { OrdersBrowser } from "./_components/orders-browser";

const section = getNavItem("/admin/pedidos");

export const metadata: Metadata = { title: "Pedidos" };

/**
 * /admin/pedidos — los pedidos de la tienda, por estado (pestañas), con
 * búsqueda, selección múltiple, impresión y los avisos que requieren
 * atención arriba de todo.
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
          <OrdersSection params={parseListParams(raw)} />
        ))}
      </Suspense>
    </>
  );
}

async function OrdersSection({ params }: { params: ListParams }) {
  const [list, counts, settings] = await Promise.all([getOrders(params), getOrderCounts(), getStoreSettings()]);

  return (
    <div className="flex flex-col gap-4">
      <AttentionAlerts counts={counts} />
      {!ownersEmail(settings) && (
        <Notice icon={Mail} tone="soft">
          <span className="flex-1">
            Cargá el <strong className="font-medium">email del negocio</strong> en Configuración para recibir un aviso
            cada vez que entra un pedido.
          </span>
          <Link href="/admin/configuracion" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "bg-background")}>
            Ir a Configuración
          </Link>
        </Notice>
      )}
      <OrdersBrowser params={params} list={list} counts={counts} />
    </div>
  );
}

/** "Pagado sin stock" (rojo) y "Para revisar" (ámbar), siempre arriba de todo. */
function AttentionAlerts({ counts }: { counts: OrderCounts }) {
  if (counts.stockIssue === 0 && counts.needsReview === 0) return null;
  const link = (
    <Link href="/admin/pedidos?estado=atencion" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "bg-background")}>
      Ver
    </Link>
  );
  return (
    <div className="flex flex-col gap-2">
      {counts.stockIssue > 0 && (
        <Notice icon={PackageX} tone="red">
          <span className="flex-1">
            <strong className="font-semibold">
              {counts.stockIssue === 1 ? "1 pedido pagado sin stock" : `${counts.stockIssue} pedidos pagados sin stock`}
            </strong>
            {" — "}se cobró, pero no alcanzaba el stock. Ofrecé otro producto o devolvé el dinero.
          </span>
          {link}
        </Notice>
      )}
      {counts.needsReview > 0 && (
        <Notice icon={AlertTriangle} tone="amber">
          <span className="flex-1">
            <strong className="font-semibold">
              {counts.needsReview === 1 ? "1 pedido para revisar" : `${counts.needsReview} pedidos para revisar`}
            </strong>
            {" — "}algo del pago no cerró. Revisalo antes de prepararlo.
          </span>
          {link}
        </Notice>
      )}
    </div>
  );
}

function Notice({
  icon: Icon,
  tone,
  children,
}: {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  tone: "red" | "amber" | "soft";
  children: React.ReactNode;
}) {
  return (
    <div
      role={tone === "soft" ? undefined : "alert"}
      className={cn(
        "flex flex-col gap-3 rounded-xl border px-4 py-3 text-sm sm:flex-row sm:items-center",
        tone === "red" && "border-brand/30 bg-brand-soft text-brand",
        tone === "amber" && "border-amber-300 bg-amber-50 text-amber-900",
        tone === "soft" && "bg-card text-muted-foreground",
      )}
    >
      <Icon className="size-5 shrink-0" aria-hidden />
      {children}
    </div>
  );
}

function OrdersSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-9 w-28 rounded-full" />
        ))}
      </div>
      <Skeleton className="h-9 w-full" />
      <div className="flex flex-col gap-2 rounded-xl border bg-card p-4">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </div>
  );
}
