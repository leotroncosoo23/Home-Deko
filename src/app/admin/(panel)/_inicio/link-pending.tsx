"use client";

import { useLinkStatus } from "next/link";
import { LoaderCircle } from "lucide-react";

/**
 * Va DENTRO de un <Link>: mientras carga la página a la que lleva, muestra
 * un ícono girando (así se nota que el cambio de período "agarró").
 */
export function LinkPending() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return <LoaderCircle className="size-3.5 animate-spin motion-reduce:animate-none" aria-label="Cargando" />;
}
