"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ScanBarcode, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { findProductByCode } from "../actions";
import {
  hasFilters,
  NO_CATEGORY,
  SORTS,
  STATUS_FILTERS,
  STOCK_FILTERS,
  type ListParams,
  type SortKey,
  type StatusFilter,
  type StockFilter,
} from "../list-params";
import type { CategoryChoice } from "../types";

const ALL = "todas";
/** Lo que parece un código de barras o SKU (sin espacios). */
const CODE_PATTERN = /^[A-Za-z0-9._-]{3,60}$/;

/**
 * Buscador + filtros + orden. Cada cambio actualiza la URL (ver
 * list-params.ts); la búsqueda espera 0,3 s después de la última tecla.
 *
 * Escáner (lector USB): escribe el código muy rápido y aprieta Enter. Al
 * apretar Enter, si el texto es un código de barras o SKU EXACTO, se abre
 * directamente ese producto.
 */
export function ProductsToolbar({
  params,
  categories,
  navigate,
}: {
  params: ListParams;
  categories: CategoryChoice[];
  navigate: (patch: Partial<ListParams>) => void;
}) {
  const router = useRouter();
  const [q, setQ] = useState(params.q);
  const [looking, setLooking] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  // Si la búsqueda de la URL cambia desde AFUERA (botón Atrás del
  // navegador), el campo se actualiza. Si el cambio lo mandó este mismo
  // buscador, no: mientras tanto la persona pudo seguir escribiendo.
  // (Patrón de React: ajustar el estado cuando cambia una prop.)
  const [lastSent, setLastSent] = useState(params.q);
  const [syncedQ, setSyncedQ] = useState(params.q);
  if (params.q !== syncedQ) {
    setSyncedQ(params.q);
    if (params.q !== lastSent) {
      setQ(params.q);
      setLastSent(params.q);
    }
  }

  function send(text: string) {
    setLastSent(text);
    navigate({ q: text, pagina: 1 });
  }

  function search(text: string, wait: number) {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => send(text), wait);
  }

  async function handleEnter() {
    if (timer.current) clearTimeout(timer.current);
    const code = q.trim();
    if (CODE_PATTERN.test(code)) {
      setLooking(true);
      try {
        const found = await findProductByCode(code);
        if (found) {
          router.push(`/admin/productos/${found.productId}`);
          return;
        }
      } catch {
        // si falla la búsqueda exacta, se busca normal
      } finally {
        setLooking(false);
      }
    }
    send(code);
  }

  const categoryItems = [
    { value: ALL, label: "Todas las categorías" },
    { value: NO_CATEGORY, label: "Sin categoría" },
    ...categories.map((c) => ({ value: c.id, label: c.name })),
  ];
  const statusItems = Object.entries(STATUS_FILTERS).map(([value, label]) => ({ value, label }));
  const stockItems = Object.entries(STOCK_FILTERS).map(([value, label]) => ({ value, label }));
  const sortItems = Object.entries(SORTS).map(([value, label]) => ({ value, label }));

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
      {/* Buscador */}
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
              void handleEnter();
            }
          }}
          placeholder="Buscar por nombre, SKU o código de barras"
          aria-label="Buscar productos por nombre, SKU o código de barras"
          autoComplete="off"
          spellCheck={false}
          className="h-9 w-full rounded-lg border border-input bg-background pr-16 pl-8 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20 [&::-webkit-search-cancel-button]:hidden"
        />
        <span className="absolute top-1/2 right-2 flex -translate-y-1/2 items-center gap-1">
          {looking ? (
            <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Buscando el código…" />
          ) : q ? (
            <button
              type="button"
              onClick={() => {
                setQ("");
                search("", 0);
              }}
              className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Borrar la búsqueda"
            >
              <X className="size-3.5" />
            </button>
          ) : (
            <ScanBarcode className="size-4 text-muted-foreground/60" aria-hidden />
          )}
        </span>
      </div>

      {/* Filtros y orden */}
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
        <FilterSelect
          label="Categoría"
          items={categoryItems}
          value={params.cat ?? ALL}
          onChange={(value) => navigate({ cat: value === ALL ? null : value, pagina: 1 })}
        />
        <FilterSelect
          label="Estado"
          items={statusItems}
          value={params.estado}
          onChange={(value) => navigate({ estado: value as StatusFilter, pagina: 1 })}
        />
        <FilterSelect
          label="Stock"
          items={stockItems}
          value={params.stock}
          onChange={(value) => navigate({ stock: value as StockFilter, pagina: 1 })}
        />
        <FilterSelect
          label="Ordenar"
          items={sortItems}
          value={params.orden}
          onChange={(value) => navigate({ orden: value as SortKey, pagina: 1 })}
        />
        {hasFilters(params) && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="col-span-2 text-muted-foreground"
            onClick={() => {
              if (timer.current) clearTimeout(timer.current);
              setQ("");
              setLastSent("");
              navigate({ q: "", cat: null, estado: "activos", stock: "todos", pagina: 1 });
            }}
          >
            <X /> Limpiar filtros
          </Button>
        )}
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  items,
  value,
  onChange,
}: {
  label: string;
  items: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Select items={items} value={value} onValueChange={(v) => v && onChange(String(v))}>
      <SelectTrigger size="default" aria-label={label} className="h-9 w-full bg-background sm:w-auto sm:min-w-36">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
