"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { autoUpdate, flip, offset, shift, size, useFloating } from "@floating-ui/react-dom";
import { cn } from "cn";

/**
 * Panel flotante pegado a un elemento (ej.: la lista de resultados de un
 * buscador). Se dibuja en un "portal", al final de la página, así NINGUNA
 * tarjeta lo recorta (las tarjetas tienen overflow-hidden para respetar
 * sus esquinas redondeadas).
 *
 *   const [anchor, setAnchor] = useState<HTMLElement | null>(null);
 *   <div ref={setAnchor}><input … /></div>
 *   <FloatingPanel anchor={anchor} open={abierto} onDismiss={cerrar}>…</FloatingPanel>
 *
 * La posición la calcula Floating UI (la misma librería que usa Base UI
 * para los selectores y menús):
 *   - abajo del ancla y con su mismo ancho;
 *   - si abajo no entra (ej.: en el celular con el teclado abierto), se
 *     da vuelta hacia arriba;
 *   - nunca se sale de la pantalla y su alto se ajusta al lugar que hay;
 *   - se reubica sola al hacer scroll o cambiar el tamaño de la ventana.
 */
export function FloatingPanel({
  anchor,
  open,
  onDismiss,
  className,
  children,
  ...props
}: {
  /** El elemento al que se pega (y cuyo ancho toma). */
  anchor: HTMLElement | null;
  open: boolean;
  /** Se llama al tocar afuera (ni en el ancla ni en el panel). */
  onDismiss?: () => void;
} & Omit<React.ComponentProps<"div">, "ref" | "style">) {
  // El panel también se guarda como estado (no como ref): así React sabe
  // cuándo cambió y Floating UI lo posiciona apenas aparece.
  const [panel, setPanel] = useState<HTMLDivElement | null>(null);
  const { floatingStyles, isPositioned } = useFloating({
    open,
    strategy: "fixed",
    placement: "bottom-start",
    elements: { reference: anchor, floating: panel },
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(4),
      flip({ padding: 8 }),
      shift({ padding: 8 }),
      size({
        padding: 8,
        apply({ rects, availableHeight, elements: els }) {
          Object.assign(els.floating.style, {
            width: `${rects.reference.width}px`,
            maxHeight: `${Math.max(120, Math.min(availableHeight, 384))}px`,
          });
        },
      }),
    ],
  });

  // Cerrar al tocar o hacer clic afuera
  useEffect(() => {
    if (!open || !onDismiss) return;
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (panel?.contains(target) || anchor?.contains(target)) return;
      onDismiss?.();
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, onDismiss, anchor, panel]);

  if (!open || !anchor) return null;

  return createPortal(
    <div
      ref={setPanel}
      // Hasta que se calcula la posición, invisible (evita un "salto")
      style={{ ...floatingStyles, visibility: isPositioned ? "visible" : "hidden" }}
      className={cn(
        "z-40 overflow-y-auto overscroll-contain rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg ring-1 ring-foreground/5",
        className,
      )}
      {...props}
    >
      {children}
    </div>,
    document.body,
  );
}
