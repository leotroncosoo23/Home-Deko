"use client";

import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import { setCustomerView } from "../actions";

/** Botón "Ver como cliente" / "Volver a la vista de admin" de la barra de admin. */
export function CustomerViewToggle({ customerView }: { customerView: boolean }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => setCustomerView(!customerView))}
      className="inline-flex items-center gap-1.5 font-semibold underline underline-offset-4 hover:opacity-80 disabled:opacity-70"
    >
      {pending && <Loader2 aria-hidden className="size-3.5 animate-spin" />}
      {customerView ? "Volver a la vista de admin" : "Ver como cliente"}
    </button>
  );
}
