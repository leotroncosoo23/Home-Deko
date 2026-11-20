import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { SEARCH_PATH } from "@/lib/store-nav";

/**
 * Buscador de la tienda: un formulario común que va a /buscar?q=...
 * (funciona aunque no cargue JavaScript).
 */
export function SearchForm({
  autoFocus,
  className,
  inputId,
  defaultValue,
}: {
  autoFocus?: boolean;
  className?: string;
  /** Hace falta si hay más de un buscador en la página (el del encabezado usa "buscar"). */
  inputId?: string;
  /** En /buscar: la búsqueda actual, para corregirla sin volver a escribir todo. */
  defaultValue?: string;
}) {
  const id = inputId ?? (autoFocus ? "buscar-celular" : "buscar");
  return (
    <form action={SEARCH_PATH} method="get" role="search" className={cn("relative", className)}>
      <label htmlFor={id} className="sr-only">
        Buscar productos
      </label>
      <Search
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <input
        id={id}
        defaultValue={defaultValue}
        name="q"
        type="search"
        required
        autoFocus={autoFocus}
        autoComplete="off"
        enterKeyHint="search"
        placeholder="¿Qué estás buscando?"
        // text-base en el celular: con menos de 16 px el iPhone hace zoom al tocar
        className="h-11 w-full rounded-full border border-input bg-background pr-4 pl-10 text-base outline-none placeholder:text-muted-foreground focus-visible:border-brand focus-visible:ring-3 focus-visible:ring-brand/15 md:h-10 md:text-sm [&::-webkit-search-cancel-button]:hidden"
      />
    </form>
  );
}
