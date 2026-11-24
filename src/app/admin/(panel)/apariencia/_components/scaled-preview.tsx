"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "cn";

/**
 * Muestra su contenido con un ANCHO FIJO (ej.: 1152 px, como en la tienda
 * en PC) y lo achica para que entre en la caja, como una foto de pantalla.
 * Así la vista previa del banner es fiel aunque la columna sea angosta.
 *
 * Es solo para mirar: el contenido es "inert" (no se puede tocar ni enfocar,
 * así los links del banner no navegan).
 */
export function ScaledPreview({
  width,
  className,
  children,
}: {
  /** Ancho real con el que se dibuja (px). */
  width: number;
  className?: string;
  children: React.ReactNode;
}) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ scale: number; height: number } | null>(null);

  useEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;

    // Se recalcula cuando cambia el ancho de la columna o el alto del banner
    // (ej.: al escribir un texto más largo o cargar una foto).
    function update() {
      const scale = Math.min(1, outer!.clientWidth / width);
      setSize({ scale, height: inner!.offsetHeight * scale });
    }
    const observer = new ResizeObserver(update);
    observer.observe(outer);
    observer.observe(inner);
    return () => observer.disconnect();
  }, [width]);

  return (
    <div
      ref={outerRef}
      className={cn("relative overflow-hidden", className)}
      style={{ height: size?.height }}
    >
      <div
        ref={innerRef}
        inert
        style={{
          width,
          transform: `scale(${size?.scale ?? 1})`,
          transformOrigin: "top left",
          // Hasta medir, invisible (evita un "salto" del tamaño real al chico)
          visibility: size ? "visible" : "hidden",
        }}
      >
        {children}
      </div>
    </div>
  );
}
