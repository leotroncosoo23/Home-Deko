"use client";

import Link, { useLinkStatus } from "next/link";
import { Loader2 } from "lucide-react";

/**
 * "Ver más": es un LINK a la tanda siguiente (?pagina=2, 3…), no un botón
 * que agrega productos con JavaScript. Así:
 *   - el link se puede compartir y abre con los mismos productos,
 *   - al entrar a un producto y volver "atrás", la lista sigue ahí,
 *   - funciona aunque no cargue JavaScript.
 * scroll={false}: la página no salta arriba; los productos nuevos aparecen abajo.
 */
export function LoadMore({ href, shown, total }: { href: string; shown: number; total: number }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-sm text-muted-foreground tabular-nums">
        Estás viendo {shown} de {total} productos
      </p>
      <Link
        href={href}
        scroll={false}
        className="inline-flex h-12 min-w-44 items-center justify-center gap-2 rounded-full border-2 border-foreground bg-background px-8 text-base font-semibold transition-colors hover:bg-foreground hover:text-background focus-visible:ring-4 focus-visible:ring-ring/30 focus-visible:outline-none"
      >
        <LoadMoreLabel />
      </Link>
    </div>
  );
}

/** Mientras carga la tanda siguiente, "Cargando…" con un círculo que gira. */
function LoadMoreLabel() {
  const { pending } = useLinkStatus();
  return pending ? (
    <>
      <Loader2 aria-hidden className="size-4 animate-spin" />
      Cargando…
    </>
  ) : (
    "Ver más"
  );
}
