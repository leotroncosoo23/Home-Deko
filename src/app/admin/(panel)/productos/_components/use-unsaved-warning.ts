"use client";

import { useEffect, useRef } from "react";

const MESSAGE = "Tenés cambios sin guardar. Si salís ahora, se pierden. ¿Salir igual?";

/**
 * Avisa antes de salir si hay cambios sin guardar:
 *   - al cerrar o recargar la pestaña (aviso del navegador);
 *   - al tocar un enlace del panel (barra lateral, "Cancelar", etc.).
 * La flecha "atrás" del navegador no se puede frenar en esta versión de Next.
 *
 * Devuelve `allowLeave()`: llamarla justo antes de navegar a propósito
 * (ej.: después de guardar), para que no pregunte.
 */
export function useUnsavedWarning(dirty: boolean) {
  const allowed = useRef(false);

  useEffect(() => {
    if (!dirty) return;
    allowed.current = false;

    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (allowed.current) return;
      e.preventDefault();
      e.returnValue = ""; // algunos navegadores lo necesitan para mostrar el aviso
    }

    // Se escucha en "captura" (antes que los Link de Next): si la persona
    // dice que no, el clic se frena y el Link nunca se entera.
    function onClick(e: MouseEvent) {
      if (allowed.current || e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; // abrir en otra pestaña: no se pierde nada
      const link = (e.target as Element | null)?.closest?.("a[href]");
      if (!(link instanceof HTMLAnchorElement) || link.target === "_blank" || link.hasAttribute("download")) return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;

      if (!window.confirm(MESSAGE)) {
        e.preventDefault();
        e.stopPropagation();
      } else {
        allowed.current = true;
      }
    }

    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty]);

  return {
    allowLeave: () => {
      allowed.current = true;
    },
  };
}
