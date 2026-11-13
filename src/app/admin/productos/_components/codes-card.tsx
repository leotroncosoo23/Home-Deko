"use client";

import { Barcode, SlidersHorizontal } from "lucide-react";
import { cn } from "cn";
import { SectionCard } from "@/components/admin/section-card";
import { Button } from "@/components/ui/button";
import { useAdjustStockDialog } from "../../stock/_components/adjust-stock-dialog";
import type { VariantCode } from "../types";

/**
 * Códigos de cada variante (al editar): SKU, código de barras EAN-13 (que
 * nunca cambia) y stock actual, con el botón "Ajustar" de cada una.
 */
export function CodesCard({
  codes,
  productId,
  productName,
}: {
  codes: VariantCode[];
  productId: string;
  productName: string;
}) {
  const adjust = useAdjustStockDialog();

  return (
    <SectionCard
      icon={Barcode}
      title="Códigos y stock"
      description="El código de barras no cambia nunca: se puede imprimir tranquilo."
      contentClassName="p-0"
    >
      <ul className="divide-y text-sm">
        {codes.map((c) => (
          <li key={c.id} className="flex items-center gap-3 px-(--card-spacing) py-2.5">
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate font-medium">{c.label}</span>
              <span className="font-mono text-sm tracking-wide tabular-nums">{c.barcode}</span>
              <span className="font-mono text-xs text-muted-foreground">{c.sku ? `SKU ${c.sku}` : "Sin SKU"}</span>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <span className={cn("text-xs tabular-nums", c.stock === 0 ? "font-medium text-brand" : "text-muted-foreground")}>
                Stock <span className="text-sm font-semibold text-foreground">{c.stock}</span>
              </span>
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={() => adjust.openFor(productId, productName, c.id)}
                aria-label={`Ajustar el stock de ${c.label}`}
              >
                <SlidersHorizontal /> Ajustar
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {adjust.dialog}
    </SectionCard>
  );
}
