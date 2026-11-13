import type { Metadata } from "next";
import { Suspense } from "react";
import { FileStack, Tag } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { getNavItem } from "@/components/admin/nav-items";
import { SectionCard } from "@/components/admin/section-card";
import { Skeleton } from "@/components/ui/skeleton";
import { getLabelQueue } from "./data";
import { LabelsManager } from "./_components/labels-manager";

const section = getNavItem("/admin/etiquetas");

export const metadata: Metadata = { title: "Etiquetas" };

/**
 * /admin/etiquetas — la cola de impresión y la hoja A4.
 *
 * La cola está en la base (tabla label_queue), compartida por los dos
 * dueños: se puede cargar desde el celular e imprimir desde la PC.
 * El encabezado sale al instante; la cola, dentro de <Suspense>.
 */
export default function LabelsPage() {
  return (
    <>
      <PageHeader eyebrow={section.group} title={section.title} description={section.description} />
      <Suspense fallback={<LabelsSkeleton />}>
        <Queue />
      </Suspense>
    </>
  );
}

async function Queue() {
  const items = await getLabelQueue(); // hace requireAdmin()
  return <LabelsManager items={items} />;
}

function LabelsSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start">
      <SectionCard icon={Tag} title="Cola de impresión" contentClassName="flex flex-col gap-3">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </SectionCard>
      <SectionCard icon={FileStack} title="Hoja A4" contentClassName="flex flex-col gap-3">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="mx-auto aspect-2/3 w-48" />
      </SectionCard>
    </div>
  );
}
