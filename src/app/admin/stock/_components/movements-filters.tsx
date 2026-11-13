"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { hasHistoryFilters, historyQueryString, HISTORY_PAGE_SIZE, type HistoryParams } from "../history-params";
import { REASON_LABELS, type StockReason } from "../reasons";

const ALL = "todos";

/**
 * Filtros del historial (desde, hasta, motivo, producto) y paginación.
 * Todo vive en la URL; los cambios van "en transición" (la tabla se
 * atenúa mientras llega la nueva página).
 */
export function MovementsFilters({
  params,
  productName,
  page,
  pageCount,
  total,
  children,
}: {
  params: HistoryParams;
  /** Si se filtra por un producto puntual (pid), su nombre. */
  productName: string | null;
  page: number;
  pageCount: number;
  total: number;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(params.q);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  function go(patch: Partial<HistoryParams>, mode: "replace" | "push" = "replace") {
    const next = { ...params, pagina: 1, ...patch };
    startTransition(() => router[mode](`/admin/stock${historyQueryString(next)}#historial`, { scroll: false }));
  }

  const reasonItems = [
    { value: ALL, label: "Todos los motivos" },
    ...Object.entries(REASON_LABELS).map(([value, label]) => ({ value, label })),
  ];
  const from = total === 0 ? 0 : (page - 1) * HISTORY_PAGE_SIZE + 1;
  const to = Math.min(page * HISTORY_PAGE_SIZE, total);

  return (
    <div className="flex flex-col">
      <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-end">
        <label className="flex flex-1 flex-col gap-1 text-xs text-muted-foreground">
          Producto
          <span className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" aria-hidden />
            <Input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                if (timer.current) clearTimeout(timer.current);
                const value = e.target.value;
                timer.current = setTimeout(() => go({ q: value }), 300);
              }}
              placeholder="Nombre, SKU o código"
              className="h-9 bg-background pl-8"
              autoComplete="off"
            />
          </span>
        </label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:flex">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Desde
            <Input type="date" value={params.desde} max={params.hasta || undefined} onChange={(e) => go({ desde: e.target.value })} className="h-9 bg-background" />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Hasta
            <Input type="date" value={params.hasta} min={params.desde || undefined} onChange={(e) => go({ hasta: e.target.value })} className="h-9 bg-background" />
          </label>
          <label className="col-span-2 flex flex-col gap-1 text-xs text-muted-foreground sm:col-span-1">
            Motivo
            <Select
              items={reasonItems}
              value={params.motivo ?? ALL}
              onValueChange={(v) => go({ motivo: !v || v === ALL ? null : (String(v) as StockReason) })}
            >
              <SelectTrigger className="h-9 w-full bg-background lg:w-48" aria-label="Motivo">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {reasonItems.map((i) => (
                  <SelectItem key={i.value} value={i.value}>
                    {i.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
        </div>
        {hasHistoryFilters(params) && (
          <Button
            variant="ghost"
            size="sm"
            className="self-start text-muted-foreground lg:self-end"
            onClick={() => {
              setQ("");
              go({ desde: "", hasta: "", motivo: null, q: "", pid: null });
            }}
          >
            <X /> Limpiar
          </Button>
        )}
      </div>

      {params.pid && (
        <div className="flex items-center gap-2 border-b bg-muted/40 px-4 py-2 text-sm">
          <span className="text-muted-foreground">Producto:</span>
          <span className="font-medium">{productName ?? "—"}</span>
          <button
            type="button"
            onClick={() => go({ pid: null })}
            className="ml-1 flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Quitar el filtro de producto"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

      <div className={cn("transition-opacity", pending && "pointer-events-none opacity-60")} aria-busy={pending}>
        {children}
      </div>

      <nav aria-label="Páginas del historial" className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-sm text-muted-foreground">
        <span className="tabular-nums">
          {total === 0 ? "Sin movimientos" : `Mostrando ${from}–${to} de ${total}`}
        </span>
        {pageCount > 1 && (
          <span className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => go({ pagina: page - 1 }, "push")} disabled={page <= 1}>
              <ChevronLeft /> Anterior
            </Button>
            <span className="tabular-nums">
              Página {page} de {pageCount}
            </span>
            <Button variant="outline" size="sm" onClick={() => go({ pagina: page + 1 }, "push")} disabled={page >= pageCount}>
              Siguiente <ChevronRight />
            </Button>
          </span>
        )}
      </nav>
    </div>
  );
}
