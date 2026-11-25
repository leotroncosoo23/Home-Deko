import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronRight, Mail, Undo2 } from "lucide-react";
import { cn } from "cn";
import { HelpSheet } from "@/components/admin/help-sheet";
import { getNavItem } from "@/components/admin/nav-items";
import { PageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatArgentinaDateTime } from "@/lib/dates";
import { getStoreSettings, ownersEmail } from "@/lib/store-settings";
import { getWithdrawalCounts, getWithdrawals, type WithdrawalCounts, type WithdrawalRow } from "./data";
import { LIST_PATH, parseTab, STATUS_LABELS, STATUS_STYLES, TABS, type WithdrawalTab } from "./status";

const section = getNavItem("/admin/arrepentimientos");

export const metadata: Metadata = { title: "Arrepentimientos" };

/**
 * /admin/arrepentimientos — solicitudes del Botón de arrepentimiento de la
 * tienda (Disposición 954/2025), por estado. El cliente ya recibió su código
 * al enviarla; acá los dueños lo contactan y coordinan la devolución.
 */
export default function WithdrawalsPage({ searchParams }: PageProps<"/admin/arrepentimientos">) {
  return (
    <>
      <PageHeader
        eyebrow={section.group}
        title={section.title}
        description={section.description}
        actions={<HelpSheet guia="arrepentimientos" />}
      />
      <Suspense fallback={<ListSkeleton />}>
        {searchParams.then((raw) => (
          <WithdrawalsSection tab={parseTab(raw.estado)} />
        ))}
      </Suspense>
    </>
  );
}

async function WithdrawalsSection({ tab }: { tab: WithdrawalTab }) {
  const [rows, counts, settings] = await Promise.all([getWithdrawals(tab), getWithdrawalCounts(), getStoreSettings()]);

  return (
    <div className="flex flex-col gap-4">
      {!ownersEmail(settings) && (
        <div className="flex flex-col gap-3 rounded-xl border bg-card px-4 py-3 text-sm text-muted-foreground sm:flex-row sm:items-center">
          <Mail className="size-5 shrink-0" aria-hidden />
          <span className="flex-1">
            Cargá el <strong className="font-medium">email del negocio</strong> en Configuración para recibir un aviso
            cada vez que llega una solicitud.
          </span>
          <Link
            href="/admin/configuracion"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "bg-background")}
          >
            Ir a Configuración
          </Link>
        </div>
      )}

      <Tabs active={tab} counts={counts} />

      {rows.length === 0 ? (
        <Empty tab={tab} />
      ) : (
        <ul className="flex flex-col overflow-hidden rounded-xl border bg-card">
          {rows.map((r) => (
            <Row key={r.id} row={r} />
          ))}
        </ul>
      )}
    </div>
  );
}

function Tabs({ active, counts }: { active: WithdrawalTab; counts: WithdrawalCounts }) {
  return (
    <nav aria-label="Filtrar por estado" className="-mx-1 overflow-x-auto px-1 pb-1">
      <ul className="flex gap-2">
        {(Object.keys(TABS) as WithdrawalTab[]).map((tab) => {
          const isActive = tab === active;
          const attention = tab === "nuevas" && counts.nuevas > 0;
          return (
            <li key={tab}>
              <Link
                href={tab === "nuevas" ? LIST_PATH : `${LIST_PATH}?estado=${tab}`}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/20",
                  isActive ? "border-foreground bg-foreground text-background" : "bg-background hover:bg-muted",
                )}
              >
                {TABS[tab].label}
                <span
                  className={cn(
                    "min-w-5 rounded-full px-1.5 text-xs leading-5 tabular-nums",
                    isActive
                      ? "bg-background/20 text-background"
                      : attention
                        ? "bg-brand text-white"
                        : "bg-muted text-muted-foreground",
                  )}
                >
                  {counts[tab]}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function Row({ row }: { row: WithdrawalRow }) {
  return (
    <li className="not-last:border-b">
      <Link
        href={`${LIST_PATH}/${row.id}`}
        className="flex items-center gap-4 px-4 py-3.5 transition-colors outline-none hover:bg-muted/60 focus-visible:bg-muted/60"
      >
        <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
          <span className="w-28 shrink-0 font-mono text-sm font-semibold tabular-nums">{row.code}</span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate font-medium">{row.fullName}</span>
            <span className="truncate text-sm text-muted-foreground">{row.email}</span>
          </span>
          <span className="w-28 shrink-0 text-sm text-muted-foreground tabular-nums">
            {row.orderNumber ? `Pedido #${row.orderNumber}` : "Sin n.º de pedido"}
          </span>
          <span
            className="w-32 shrink-0 text-sm text-muted-foreground"
            title={formatArgentinaDateTime(row.createdAt)}
          >
            {row.receivedAgo}
          </span>
        </div>
        <Badge className={STATUS_STYLES[row.status]}>{STATUS_LABELS[row.status]}</Badge>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </Link>
    </li>
  );
}

const EMPTY: Record<WithdrawalTab, string> = {
  nuevas: "No hay solicitudes nuevas. Cuando un cliente use el Botón de arrepentimiento, aparece acá.",
  gestion: "No hay solicitudes en gestión.",
  cerradas: "Todavía no hay solicitudes cerradas.",
  todas: "Todavía no llegó ninguna solicitud del Botón de arrepentimiento.",
};

function Empty({ tab }: { tab: WithdrawalTab }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border bg-card px-6 py-12 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-brand-soft text-brand">
        <Undo2 className="size-6" aria-hidden />
      </span>
      <p className="max-w-sm text-sm text-muted-foreground">{EMPTY[tab]}</p>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-9 w-28 rounded-full" />
        ))}
      </div>
      <div className="flex flex-col gap-2 rounded-xl border bg-card p-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </div>
  );
}
