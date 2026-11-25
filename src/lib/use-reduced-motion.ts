"use client";

import { useSyncExternalStore } from "react";

/**
 * ¿La persona pidió "reducir movimiento" en su sistema? Se actualiza en vivo.
 * En el servidor no se sabe: devuelve false (y el CSS con motion-reduce:
 * frena lo que haga falta hasta que hidrata).
 */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia("(prefers-reduced-motion: reduce)");
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
}
