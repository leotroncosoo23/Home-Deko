"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, ClipboardList, Loader2, PackageOpen, Printer, Search, SearchX, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { markOrdersPreparing } from "../actions";
import type { OrderCounts, OrdersPage } from "../data";
import {
  DELIVERY_FILTERS,
  LIST_PATH,
  PAGE_SIZE,
  TABS,
  toQueryString,
  type DeliveryFilter,
  type ListParams,
  type Tab,
} from "../list-params";
import { OrdersTable } from "./orders-table";
import { usePrintOrders } from "./print-dialogs";

/** Pestañas visibles, en el orden del despacho. */
const VISIBLE_TABS: Exclude<Tab, "atencion">[] = ["preparar", "preparando", "enviados", "retirar", "listos", "todos"];

const EMPTY: Record<Tab, string> = {
  preparar: "No hay pedidos para preparar. ¡Todo al día!",
  preparando: "No hay pedidos en preparación.",
  enviados: "No hay pedidos en camino.",
  retirar: "No hay pedidos esperando que los retiren.",
  listos: "Acá van a aparecer los pedidos entregados y retirados.",
  todos: "Acá vas a ver los pedidos cuando los clientes compren en la tienda.",
  atencion: "No hay pedidos que requieran atención.",
};

/**
 * La lista de pedidos: pestañas por estado (con contador), buscador,
 * filtro envío / retiro, selección múltiple y acciones (imprimir y
 * "Preparando"). Los filtros viven en la URL (list-params.ts).
 */
export function OrdersBrowser({ params, list, counts }: { params: ListParams; list: OrdersPage; counts: OrderCounts }) {
  const router = useRouter();
  const [navigating, startNavigation] = useTransition();
  const [acting, startAction] = useTransition();
  const print = usePrintOrders();

  const query = toQueryString(params);

  // ----- Selección: se vacía al cambiar de pestaña, filtro o página -------
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectionFor, setSelectionFor] = useState(query);
  if (selectionFor !== query) {
    setSelectionFor(query);
    setSelected(new Set());
  }
  const selectedItems = list.items.filter((i) => selected.has(i.id));
  const selectedIds = selectedItems.map((i) => i.id);

  function navigate(patch: Partial<ListParams>, mode: "replace" | "push" = "replace") {
    const next = { ...params, ...patch };
    startNavigation(() => {
      router[mode](`${LIST_PATH}${toQueryString(next)}`, { scroll: mode === "push" });
    });
  }

  function preparing() {
    startAction(async () => {
      try {
        const result = await markOrdersPreparing(selectedIds);
        if (result.ok) {
          toast.success(result.message);
          setSelected(new Set());
        } else toast.error(result.error);
      } catch {
        toast.error("No se pudo completar. Revisá tu conexión e intentá de nuevo.");
      }
    });
  }

  const hasSearch = Boolean(params.q.trim()) || params.entrega !== "todas";

  return (
    <div className="flex flex-col gap-4">
      {/* ----- Pestañas ----- */}
      <nav aria-label="Estados de los pedidos" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="flex w-max gap-2 sm:w-auto sm:flex-wrap">
          {params.estado === "atencion" && (
            <li>
              <TabButton active count={counts.stockIssue + counts.needsReview} attention onClick={() => {}}>
                {TABS.atencion}
              </TabButton>
            </li>
          )}
          {VISIBLE_TABS.map((tab) => (
            <li key={tab}>
              <TabButton
                active={params.estado === tab}
                count={counts[tab]}
                attention={tab === "preparar" && counts.preparar > 0}
                onClick={() => navigate({ estado: tab, pagina: 1, sinPagar: false })}
              >
                {TABS[tab]}
              </TabButton>
            </li>
          ))}
        </ul>
      </nav>

      {/* ----- Buscador y filtros ----- */}
      <Toolbar params={params} navigate={navigate} />

      {/* ----- Acciones para los seleccionados ----- */}
      {selectedIds.length > 0 && (
        <div
          role="region"
          aria-label="Acciones para los pedidos seleccionados"
          className="sticky top-16 z-10 flex flex-wrap items-center gap-1.5 rounded-xl border border-foreground/15 bg-foreground px-3 py-2 text-background shadow-(--shadow-card)"
        >
          <span className="mr-1 text-sm font-medium tabular-nums">
            {selectedIds.length === 1 ? "1 seleccionado" : `${selectedIds.length} seleccionados`}
          </span>
          <BarButton onClick={() => print.picking(selectedIds)} disabled={print.loading}>
            <ClipboardList /> Lista de preparación
          </BarButton>
          <BarButton onClick={() => print.labels(selectedIds)} disabled={print.loading}>
            <Printer /> Imprimir rótulos
          </BarButton>
          {selectedItems.some((i) => i.fulfillmentStatus === "paid" && i.paymentStatus === "approved") && (
            <BarButton onClick={preparing} disabled={acting}>
              {acting ? <Loader2 className="animate-spin" /> : <PackageOpen />} Marcar como Preparando
            </BarButton>
          )}
          {print.loading && <Loader2 className="size-4 animate-spin text-background/70" aria-label="Cargando…" />}
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="ml-auto flex size-8 items-center justify-center rounded-md text-background/70 outline-none hover:bg-background/10 hover:text-background focus-visible:ring-2 focus-visible:ring-background/50"
            aria-label="Quitar la selección"
            title="Quitar la selección"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* ----- Lista ----- */}
      <div
        className={cn(
          "overflow-hidden rounded-xl border bg-card shadow-(--shadow-card) transition-opacity",
          navigating && "pointer-events-none opacity-60",
        )}
        aria-busy={navigating}
      >
        {list.items.length > 0 ? (
          <OrdersTable
            items={list.items}
            selected={selected}
            onToggle={(id, checked) =>
              setSelected((prev) => {
                const next = new Set(prev);
                if (checked) next.add(id);
                else next.delete(id);
                return next;
              })
            }
            onToggleAll={(checked) => setSelected(checked ? new Set(list.items.map((i) => i.id)) : new Set())}
          />
        ) : (
          <div className="flex flex-col items-center gap-3 px-4 py-12 text-center text-sm text-muted-foreground">
            {hasSearch ? (
              <>
                <SearchX className="size-6" aria-hidden />
                <p>No hay pedidos con esa búsqueda en «{TABS[params.estado]}».</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate({ q: "", entrega: "todas", pagina: 1 })}
                  className="bg-background"
                >
                  Limpiar la búsqueda
                </Button>
              </>
            ) : (
              <p>{EMPTY[params.estado]}</p>
            )}
          </div>
        )}
      </div>

      {list.total > 0 && (
        <nav aria-label="Páginas" className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
          <span className="tabular-nums">
            {list.total <= PAGE_SIZE
              ? list.total === 1
                ? "1 pedido"
                : `${list.total} pedidos`
              : `Mostrando ${(list.page - 1) * PAGE_SIZE + 1}–${Math.min(list.page * PAGE_SIZE, list.total)} de ${list.total} pedidos`}
          </span>
          {list.pageCount > 1 && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate({ pagina: list.page - 1 }, "push")}
                disabled={list.page <= 1}
                className="bg-background"
              >
                <ChevronLeft /> Anterior
              </Button>
              <span className="tabular-nums">
                Página {list.page} de {list.pageCount}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate({ pagina: list.page + 1 }, "push")}
                disabled={list.page >= list.pageCount}
                className="bg-background"
              >
                Siguiente <ChevronRight />
              </Button>
            </div>
          )}
        </nav>
      )}

      {print.dialogs}
    </div>
  );
}

function TabButton({
  active,
  count,
  attention,
  onClick,
  children,
}: {
  active: boolean;
  count: number;
  attention?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/20",
        active ? "border-foreground bg-foreground text-background" : "bg-background hover:bg-muted",
      )}
    >
      {children}
      <span
        className={cn(
          "min-w-5 rounded-full px-1.5 text-xs leading-5 tabular-nums",
          active
            ? "bg-background/20 text-background"
            : attention && count > 0
              ? "bg-brand text-white"
              : "bg-muted text-muted-foreground",
        )}
      >
        {count}
      </span>
    </button>
  );
}

function BarButton({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex h-8 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium text-background/90 outline-none hover:bg-background/10 hover:text-background focus-visible:ring-2 focus-visible:ring-background/50 disabled:cursor-not-allowed disabled:opacity-45 [&_svg]:size-4"
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Buscador + envío/retiro (+ "sin pagar" en Todos)
// ---------------------------------------------------------------------------
function Toolbar({ params, navigate }: { params: ListParams; navigate: (patch: Partial<ListParams>) => void }) {
  const [q, setQ] = useState(params.q);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  // Si la búsqueda de la URL cambia desde afuera (botón Atrás), el campo se
  // actualiza; si la mandó este buscador, no (la persona pudo seguir escribiendo).
  const [lastSent, setLastSent] = useState(params.q);
  const [syncedQ, setSyncedQ] = useState(params.q);
  if (params.q !== syncedQ) {
    setSyncedQ(params.q);
    if (params.q !== lastSent) {
      setQ(params.q);
      setLastSent(params.q);
    }
  }

  function search(text: string, wait: number) {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setLastSent(text);
      navigate({ q: text, pagina: 1 });
    }, wait);
  }

  const deliveryItems = Object.entries(DELIVERY_FILTERS).map(([value, label]) => ({ value, label }));

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <input
          type="search"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            search(e.target.value, 300);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              search(q, 0);
            }
          }}
          placeholder="Buscar por número, nombre o email"
          aria-label="Buscar pedidos por número, nombre o email del cliente"
          autoComplete="off"
          spellCheck={false}
          className="h-9 w-full rounded-lg border border-input bg-background pr-9 pl-8 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20 [&::-webkit-search-cancel-button]:hidden"
        />
        {q && (
          <button
            type="button"
            onClick={() => {
              setQ("");
              search("", 0);
            }}
            className="absolute top-1/2 right-2 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Borrar la búsqueda"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Select
          items={deliveryItems}
          value={params.entrega}
          onValueChange={(v) => v && navigate({ entrega: v as DeliveryFilter, pagina: 1 })}
        >
          <SelectTrigger size="default" aria-label="Envío o retiro" className="h-9 w-full bg-background sm:w-auto sm:min-w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {deliveryItems.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {params.estado === "todos" && (
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Checkbox
              checked={params.sinPagar}
              onCheckedChange={(c) => navigate({ sinPagar: Boolean(c), pagina: 1 })}
            />
            Ver también los que no se pagaron
          </label>
        )}
      </div>
    </div>
  );
}
