import type { Metadata } from "next";
import { Suspense } from "react";
import { AlertTriangle, History } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { getNavItem } from "@/components/admin/nav-items";
import { SectionCard } from "@/components/admin/section-card";
import { Skeleton } from "@/components/ui/skeleton";
import { getMovements, getProductName, getRestockList } from "./data";
import { historyQueryString, parseHistoryParams, type HistoryParams, type RestockFilter } from "./history-params";
import { MovementsFilters } from "./_components/movements-filters";
import { MovementsTable } from "./_components/movements-table";
import { QuickIntake } from "./_components/quick-intake";
import { RestockList } from "./_components/restock-list";

const section = getNavItem("/admin/stock");

export const metadata: Metadata = { title: "Stock" };

/**
 * /admin/stock
 *   1. Ingreso rápido (no necesita datos: aparece al instante).
 *   2. Para reponer (variantes sin stock o con stock bajo).
 *   3. Historial de movimientos con filtros (en la URL).
 * Las partes con datos leen la URL y la base, por eso van en <Suspense>.
 */
export default function StockPage({ searchParams }: PageProps<"/admin/stock">) {
  return (
    <>
      <PageHeader eyebrow={section.group} title={section.title} description={section.description} />
      <QuickIntake />
      <Suspense fallback={<CardSkeleton title="Para reponer" icon="alert" />}>
        {searchParams.then((raw) => (
          <RestockSection params={parseHistoryParams(raw)} />
        ))}
      </Suspense>
      <Suspense fallback={<CardSkeleton title="Historial de movimientos" icon="history" />}>
        {searchParams.then((raw) => (
          <HistorySection params={parseHistoryParams(raw)} />
        ))}
      </Suspense>
    </>
  );
}

async function RestockSection({ params }: { params: HistoryParams }) {
  const { items, total } = await getRestockList(params.reponer);
  const hrefFor = Object.fromEntries(
    (["todas", "sin", "bajo"] as RestockFilter[]).map((reponer) => [
      reponer,
      `/admin/stock${historyQueryString({ ...params, reponer })}`,
    ]),
  ) as Record<RestockFilter, string>;

  return (
    <SectionCard
      icon={AlertTriangle}
      title="Para reponer"
      description={
        total === 0
          ? "No hay variantes sin stock ni con stock bajo."
          : `${total} ${total === 1 ? "variante" : "variantes"} sin stock o en su mínimo (de productos publicados y borradores).`
      }
      contentClassName="p-0"
    >
      <RestockList items={items} total={total} filter={params.reponer} hrefFor={hrefFor} />
    </SectionCard>
  );
}

async function HistorySection({ params }: { params: HistoryParams }) {
  const [page, productName] = await Promise.all([
    getMovements(params),
    params.pid ? getProductName(params.pid) : Promise.resolve(null),
  ]);

  return (
    <section id="historial" className="scroll-mt-20">
      <SectionCard
        icon={History}
        title="Historial de movimientos"
        description="Cada entrada y salida de stock, con su motivo y quién la hizo."
        contentClassName="p-0"
      >
        <MovementsFilters
          params={params}
          productName={productName}
          page={page.page}
          pageCount={page.pageCount}
          total={page.total}
        >
          {page.items.length > 0 ? (
            <MovementsTable items={page.items} />
          ) : (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">No hay movimientos con estos filtros.</p>
          )}
        </MovementsFilters>
      </SectionCard>
    </section>
  );
}

function CardSkeleton({ title, icon }: { title: string; icon: "alert" | "history" }) {
  const Icon = icon === "alert" ? AlertTriangle : History;
  return (
    <SectionCard icon={Icon} title={title} contentClassName="flex flex-col gap-3">
      {Array.from({ length: 4 }, (_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </SectionCard>
  );
}
