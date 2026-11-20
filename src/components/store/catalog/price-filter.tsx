"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * Filtro de precio: "Desde $" y "Hasta $" + "Aplicar".
 *
 * Es un formulario GET común (sin JavaScript también funciona). Con
 * JavaScript arma un link limpio (sin "min=&max=" vacíos) y navega sin
 * recargar la página. Si ponen el mínimo más alto que el máximo, el
 * servidor los invierte solo (src/lib/catalog-params.ts).
 */
export function PriceFilter({
  action,
  keep,
  min,
  max,
  idPrefix,
}: {
  /** Página a la que va el formulario (/productos, /categorias/x o /buscar). */
  action: string;
  /** Parámetros que se conservan (búsqueda, categoría, orden). */
  keep: Record<string, string>;
  min: number | null;
  max: number | null;
  /** Para que los id no se repitan (el filtro está en la columna y en el panel del celular). */
  idPrefix: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const sp = new URLSearchParams(keep);
    for (const name of ["min", "max"]) {
      const digits = String(form.get(name) ?? "").split(",")[0].replace(/\D/g, "");
      if (digits && Number(digits) > 0) sp.set(name, digits);
    }
    const query = sp.toString();
    startTransition(() => router.push(query ? `${action}?${query}` : action, { scroll: false }));
  }

  return (
    // key: si cambian los valores de la URL (atrás, "Limpiar filtros"), los campos se reinician.
    <form key={`${min}-${max}`} action={action} method="get" onSubmit={onSubmit} className="flex flex-col gap-3">
      {Object.entries(keep).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <div className="grid grid-cols-2 gap-2">
        <PriceInput id={`${idPrefix}-min`} name="min" label="Desde" defaultValue={min} />
        <PriceInput id={`${idPrefix}-max`} name="max" label="Hasta" defaultValue={max} />
      </div>
      <button
        type="submit"
        disabled={pending}
        className={cn(
          // Secundario (con borde): la acción principal de la tienda es comprar, no filtrar.
          "h-10 rounded-full border border-input lg:h-9 bg-background px-5 text-sm font-semibold text-foreground transition-colors hover:border-foreground/40 hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/30 focus-visible:outline-none",
          pending && "opacity-60",
        )}
      >
        {pending ? "Aplicando…" : "Aplicar"}
      </button>
    </form>
  );
}

function PriceInput({
  id,
  name,
  label,
  defaultValue,
}: {
  id: string;
  name: string;
  label: string;
  defaultValue: number | null;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <div className="relative">
        <span aria-hidden className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">
          $
        </span>
        <input
          id={id}
          name={name}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          defaultValue={defaultValue ?? ""}
          placeholder={name === "min" ? "0" : "Sin tope"}
          // text-base en el celular: con menos de 16 px el iPhone hace zoom al tocar
          className="h-10 w-full rounded-lg lg:h-9 border border-input bg-background pr-2 pl-6 text-base tabular-nums outline-none placeholder:text-muted-foreground/70 focus-visible:border-brand focus-visible:ring-3 focus-visible:ring-brand/15 md:text-sm"
        />
      </div>
    </div>
  );
}
