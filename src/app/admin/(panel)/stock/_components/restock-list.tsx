"use client";

import Image from "next/image";
import Link from "next/link";
import { ImageIcon, PackageCheck, SlidersHorizontal } from "lucide-react";
import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { RestockFilter } from "../history-params";
import type { VariantStock } from "../types";
import { useAdjustStockDialog } from "./adjust-stock-dialog";

const TABS: { value: RestockFilter; label: string }[] = [
  { value: "todas", label: "Todas" },
  { value: "sin", label: "Sin stock" },
  { value: "bajo", label: "Stock bajo" },
];

/**
 * "Para reponer": variantes sin stock (primero) o con stock bajo, cada una
 * con su botón "Ajustar". Las pestañas cambian ?reponer= en la URL.
 */
export function RestockList({
  items,
  total,
  filter,
  hrefFor,
}: {
  items: VariantStock[];
  total: number;
  filter: RestockFilter;
  /** URL con otra pestaña (mantiene los filtros del historial). */
  hrefFor: Record<RestockFilter, string>;
}) {
  const adjust = useAdjustStockDialog();

  return (
    <div className="flex flex-col">
      <nav aria-label="Filtrar lista para reponer" className="flex gap-1 border-b px-4 pt-3">
        {TABS.map((tab) => (
          <Link
            key={tab.value}
            href={hrefFor[tab.value]}
            scroll={false}
            aria-current={tab.value === filter ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-3 pb-2.5 text-sm font-medium transition-colors",
              tab.value === filter ? "border-brand text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
          <div className="flex size-10 items-center justify-center rounded-full bg-emerald-50">
            <PackageCheck className="size-5 text-emerald-700" aria-hidden />
          </div>
          <p className="text-sm font-medium">Nada para reponer</p>
          <p className="text-xs text-muted-foreground">Todas las variantes están por encima de su stock mínimo.</p>
        </div>
      ) : (
        <ul className="divide-y">
          {items.map((v) => (
            <li key={v.variantId} className="flex items-center gap-3 px-4 py-2.5">
              <div className="relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
                {v.imageUrl ? (
                  <Image src={v.imageUrl} alt="" fill sizes="40px" className="object-cover" />
                ) : (
                  <ImageIcon className="size-4 text-muted-foreground/60" aria-hidden />
                )}
              </div>
              <div className="flex min-w-0 flex-1 flex-col">
                <Link href={`/admin/productos/${v.productId}`} className="truncate text-sm font-medium hover:underline">
                  {v.productName}
                </Link>
                <span className="truncate text-xs text-muted-foreground">
                  {v.variantLabel ?? "Única"}
                  {v.sku && ` · ${v.sku}`}
                </span>
              </div>
              <div className="hidden flex-col items-end text-xs text-muted-foreground sm:flex">
                <span>
                  Stock <span className="text-sm font-semibold text-foreground tabular-nums">{v.stock}</span>
                </span>
                <span className="tabular-nums">mínimo {v.minStock}</span>
              </div>
              <span className="flex shrink-0 flex-col items-end gap-1 sm:hidden">
                <span className="text-sm font-semibold tabular-nums">{v.stock}</span>
              </span>
              {v.stockStatus === "out" ? (
                <Badge className="hidden bg-brand-soft text-brand sm:inline-flex">Sin stock</Badge>
              ) : (
                <Badge className="hidden bg-amber-50 text-amber-800 sm:inline-flex">Stock bajo</Badge>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => adjust.openFor(v.productId, v.productName, v.variantId)}
                aria-label={`Ajustar el stock de ${v.productName}${v.variantLabel ? ` ${v.variantLabel}` : ""}`}
              >
                <SlidersHorizontal />
                <span className="hidden sm:inline">Ajustar</span>
              </Button>
            </li>
          ))}
        </ul>
      )}

      {total > items.length && (
        <p className="border-t px-4 py-2.5 text-xs text-muted-foreground">
          Se muestran {items.length} de {total}. Reponé estas y aparecen las siguientes.
        </p>
      )}
      {adjust.dialog}
    </div>
  );
}
