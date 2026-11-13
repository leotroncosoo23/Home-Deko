"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Image from "next/image";
import { Check, ImageIcon, Loader2, PackagePlus, ScanBarcode, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { SectionCard } from "@/components/admin/section-card";
import { Button } from "@/components/ui/button";
import { FloatingPanel } from "@/components/ui/floating-panel";
import { parseInteger } from "@/lib/format";
import { adjustVariantStock, searchVariants } from "../actions";
import { variantFullName, type VariantStock } from "../types";

type Done = { id: string; name: string; qty: number; from: number; to: number };

/**
 * Ingreso rápido de mercadería: buscar o escanear → cantidad → Enter.
 * Después de cada ingreso, el cursor vuelve al buscador para el siguiente.
 *
 * Con el lector USB: escanea (escribe el código + Enter) → si el código es
 * exacto, la variante queda elegida y el cursor pasa a "Cantidad".
 */
export function QuickIntake() {
  const searchRef = useRef<HTMLInputElement>(null);
  const qtyRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const [text, setText] = useState("");
  const [results, setResults] = useState<VariantStock[]>([]);
  const [highlight, setHighlight] = useState(0);
  const [searching, startSearch] = useTransition();
  const [selected, setSelected] = useState<VariantStock | null>(null);
  const [qty, setQty] = useState("1");
  const [saving, startSave] = useTransition();
  const [done, setDone] = useState<Done[]>([]);
  // Para descartar respuestas viejas si se escribe rápido
  const lastQuery = useRef("");
  // Contenedor del buscador: la lista de resultados flota pegada a él
  const [searchBox, setSearchBox] = useState<HTMLElement | null>(null);

  function runSearch(query: string, pickExact: boolean) {
    lastQuery.current = query;
    if (!query.trim()) {
      setResults([]);
      return;
    }
    startSearch(async () => {
      try {
        const { exact, results: found } = await searchVariants(query);
        if (lastQuery.current !== query) return; // ya se escribió otra cosa
        if (pickExact && (exact || found.length === 1)) {
          select(exact ?? found[0]);
          return;
        }
        setResults(found);
        setHighlight(0);
        if (pickExact && found.length === 0) toast.error(`No encontré «${query}».`);
      } catch {
        toast.error("No se pudo buscar. Revisá tu conexión.");
      }
    });
  }

  function select(variant: VariantStock) {
    setSelected(variant);
    setResults([]);
    setQty("1");
    requestAnimationFrame(() => qtyRef.current?.select());
  }

  function reset() {
    setSelected(null);
    setText("");
    setResults([]);
    lastQuery.current = "";
    requestAnimationFrame(() => searchRef.current?.focus());
  }

  function register() {
    const amount = parseInteger(qty);
    if (!selected || amount === null || Number.isNaN(amount) || amount <= 0) {
      toast.error("Escribí una cantidad mayor a 0.");
      return;
    }
    const variant = selected;
    startSave(async () => {
      try {
        const result = await adjustVariantStock({ variantId: variant.variantId, reason: "ingreso", amount, note: null });
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        toast.success(result.message);
        setDone((d) => [
          { id: crypto.randomUUID(), name: variantFullName(variant), qty: amount, from: result.newStock - amount, to: result.newStock },
          ...d,
        ].slice(0, 8));
        reset();
      } catch {
        toast.error("No se pudo registrar el ingreso. Revisá tu conexión.");
      }
    });
  }

  return (
    <SectionCard
      icon={PackagePlus}
      title="Ingreso rápido"
      description="Llegó mercadería: escaneá o buscá el producto, poné la cantidad y apretá Enter."
      contentClassName="flex flex-col gap-4"
    >
      {!selected ? (
        // La lista de resultados se ancla a este contenedor (mismo ancho)
        <div ref={setSearchBox} className="relative">
          <ScanBarcode className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            ref={searchRef}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (timer.current) clearTimeout(timer.current);
              const value = e.target.value;
              timer.current = setTimeout(() => runSearch(value, false), 250);
            }}
            onKeyDown={(e) => {
              if ((e.key === "ArrowDown" || e.key === "ArrowUp") && results.length) {
                e.preventDefault();
                const next = (highlight + (e.key === "ArrowDown" ? 1 : -1) + results.length) % results.length;
                setHighlight(next);
                // Que el marcado quede a la vista si la lista tiene scroll
                document.getElementById(`intake-${results[next].variantId}`)?.scrollIntoView({ block: "nearest" });
              } else if (e.key === "Enter") {
                e.preventDefault();
                if (timer.current) clearTimeout(timer.current);
                // Si ya hay resultados para lo escrito, Enter elige el marcado;
                // si no (ej.: lector USB), busca y elige el código exacto.
                if (results.length && lastQuery.current === text) select(results[highlight]);
                else runSearch(text, true);
              } else if (e.key === "Escape") {
                setText("");
                setResults([]);
              }
            }}
            placeholder="Escaneá o escribí nombre, SKU o código"
            aria-label="Buscar el producto que ingresa"
            role="combobox"
            aria-expanded={results.length > 0}
            aria-controls="intake-results"
            aria-activedescendant={results.length ? `intake-${results[highlight]?.variantId}` : undefined}
            autoComplete="off"
            spellCheck={false}
            className="h-11 w-full rounded-lg border border-input bg-background pr-10 pl-10 text-base outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20"
          />
          {searching && (
            <Loader2 className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-hidden />
          )}

          {/* Flota por encima de todo (no la recorta la tarjeta) */}
          <FloatingPanel
            anchor={searchBox}
            open={results.length > 0}
            onDismiss={() => setResults([])}
            id="intake-results"
            role="listbox"
            aria-label="Resultados"
          >
            {results.map((v, i) => (
              <div
                key={v.variantId}
                id={`intake-${v.variantId}`}
                role="option"
                aria-selected={i === highlight}
                // mousedown: que tocar la lista no le saque el foco al buscador;
                // click: elige (funciona igual con el mouse y con el dedo)
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => select(v)}
                onMouseEnter={() => setHighlight(i)}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 sm:py-1.5",
                  i === highlight && "bg-muted",
                )}
              >
                <Thumb url={v.imageUrl} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium">{v.productName}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {v.variantLabel ?? "Única"} · {v.sku ?? v.barcode}
                  </span>
                </span>
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">stock {v.stock}</span>
              </div>
            ))}
          </FloatingPanel>
        </div>
      ) : (
        <form
          className="flex flex-col gap-3 rounded-lg border bg-muted/40 p-3 sm:flex-row sm:items-center"
          onSubmit={(e) => {
            e.preventDefault();
            register();
          }}
        >
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Thumb url={selected.imageUrl} />
            <div className="flex min-w-0 flex-col">
              <span className="truncate font-medium">{selected.productName}</span>
              <span className="truncate text-xs text-muted-foreground">
                {selected.variantLabel ?? "Única"} · stock actual{" "}
                <span className="font-semibold text-foreground tabular-nums">{selected.stock}</span>
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              Entran
              <input
                ref={qtyRef}
                value={qty}
                onChange={(e) => setQty(e.target.value.replace(/\D/g, "").slice(0, 6))}
                onKeyDown={(e) => e.key === "Escape" && reset()}
                inputMode="numeric"
                autoComplete="off"
                aria-label="Cantidad que ingresa"
                className="h-10 w-20 rounded-lg border border-input bg-background px-3 text-right text-lg tabular-nums outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20"
              />
            </label>
            <Button type="submit" size="lg" disabled={saving}>
              {saving ? <Loader2 className="animate-spin" /> : <Check />}
              Registrar
            </Button>
            <Button type="button" variant="ghost" size="icon-lg" onClick={reset} aria-label="Elegir otro producto" disabled={saving}>
              <X />
            </Button>
          </div>
        </form>
      )}

      {done.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">Ingresos de recién</span>
          <ul className="flex flex-col divide-y rounded-lg border text-sm">
            {done.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 px-3 py-1.5">
                <span className="truncate">{d.name}</span>
                <span className="shrink-0 tabular-nums">
                  <span className="font-semibold text-emerald-700">+{d.qty}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {d.from} → {d.to}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </SectionCard>
  );
}

function Thumb({ url }: { url: string | null }) {
  return (
    <div className="relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
      {url ? <Image src={url} alt="" fill sizes="40px" className="object-cover" /> : <ImageIcon className="size-4 text-muted-foreground/60" aria-hidden />}
    </div>
  );
}
