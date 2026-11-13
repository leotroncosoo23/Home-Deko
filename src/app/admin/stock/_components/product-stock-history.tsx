import Link from "next/link";
import { ArrowRight, History } from "lucide-react";
import { SectionCard } from "@/components/admin/section-card";
import { getProductMovements } from "../data";
import { MovementsTable } from "./movements-table";

const SHOWN = 20;

/** "Historial de stock" en la edición de un producto: los últimos 20 movimientos. */
export async function ProductStockHistory({ productId }: { productId: string }) {
  const { items, total } = await getProductMovements(productId, SHOWN);

  return (
    <SectionCard
      icon={History}
      title="Historial de stock"
      description={
        total === 0
          ? "Todavía no hay movimientos."
          : total > SHOWN
            ? `Los últimos ${SHOWN} de ${total} movimientos.`
            : "Cada entrada y salida, con quién la hizo."
      }
      action={
        total > 0 && (
          <Link
            href={`/admin/stock?pid=${productId}#historial`}
            className="flex items-center gap-1 text-sm font-medium text-foreground underline-offset-4 hover:underline"
          >
            Ver todo <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        )
      }
      contentClassName="p-0"
    >
      {total > 0 && <MovementsTable items={items} showProduct={false} />}
    </SectionCard>
  );
}
