import { Barcode } from "lucide-react";
import { SectionCard } from "@/components/admin/section-card";
import type { VariantCode } from "../types";

/**
 * Códigos de cada variante (al editar): SKU y código de barras EAN-13
 * que generó la base. Los códigos de barras nunca cambian.
 */
export function CodesCard({ codes }: { codes: VariantCode[] }) {
  return (
    <SectionCard
      icon={Barcode}
      title="Códigos"
      description="El código de barras no cambia nunca: se puede imprimir tranquilo."
      contentClassName="p-0"
    >
      <ul className="divide-y text-sm">
        {codes.map((c) => (
          <li key={c.id} className="flex flex-col gap-0.5 px-(--card-spacing) py-2.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate font-medium">{c.label}</span>
              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">Stock {c.stock}</span>
            </div>
            <span className="font-mono text-sm tracking-wide tabular-nums">{c.barcode}</span>
            <span className="font-mono text-xs text-muted-foreground">{c.sku ? `SKU ${c.sku}` : "Sin SKU"}</span>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}
