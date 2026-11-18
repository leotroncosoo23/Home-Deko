"use client";

import { useState } from "react";
import { Search, X } from "lucide-react";
import { SearchForm } from "./search-form";

/**
 * Buscador en el celular: la lupa del encabezado despliega el campo
 * debajo de la barra (en PC el buscador está siempre visible).
 */
export function MobileSearch() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-label={open ? "Cerrar el buscador" : "Buscar productos"}
        aria-expanded={open}
        aria-controls="buscador-celular"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex size-10 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/20 focus-visible:outline-none"
      >
        {open ? <X className="size-[22px]" aria-hidden /> : <Search className="size-[22px]" aria-hidden />}
      </button>

      {open && (
        <div
          id="buscador-celular"
          className="absolute inset-x-0 top-full border-b bg-background px-4 py-3 shadow-sm"
        >
          <SearchForm autoFocus />
        </div>
      )}
    </>
  );
}
