"use client";

import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

/**
 * Celular y tablet: botón "Filtrar" que abre los filtros en un panel desde
 * abajo. El contenido (children) lo arma el servidor: es el mismo
 * <CatalogFilters> de la columna de PC.
 *
 * El panel se cierra solo al elegir una categoría o aplicar el precio
 * (así se ven los resultados enseguida).
 */
export function MobileFilters({ activeCount, children }: { activeCount: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger className="inline-flex h-9 items-center gap-2 rounded-full border border-input bg-background px-3.5 text-sm font-semibold transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/20 focus-visible:outline-none">
        <SlidersHorizontal aria-hidden className="size-4" />
        Filtrar
        {activeCount > 0 && (
          <span className="flex size-5 items-center justify-center rounded-full bg-brand text-xs text-white tabular-nums">
            {activeCount}
            <span className="sr-only"> {activeCount === 1 ? "filtro activo" : "filtros activos"}</span>
          </span>
        )}
      </SheetTrigger>

      <SheetContent side="bottom" className="max-h-[85dvh] gap-0 overflow-y-auto rounded-t-3xl p-0">
        <div className="flex flex-col gap-1 px-5 pt-5 pb-4">
          <SheetTitle className="font-display text-xl font-semibold">Filtrar</SheetTitle>
          <SheetDescription className="sr-only">Elegí una categoría o un rango de precio.</SheetDescription>
        </div>
        <div
          className="px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
          onClickCapture={(e) => {
            if ((e.target as HTMLElement).closest("a")) setOpen(false);
          }}
          onSubmitCapture={() => setOpen(false)}
        >
          {children}
        </div>
      </SheetContent>
    </Sheet>
  );
}
