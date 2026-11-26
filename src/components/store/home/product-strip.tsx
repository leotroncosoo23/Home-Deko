"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "cn";
import { usePrefersReducedMotion } from "@/lib/use-reduced-motion";

/**
 * TIRA DE PRODUCTOS del inicio (Novedades, Ofertas, Más vendidos / Destacados).
 *
 *   [celular] fila que se desliza con el dedo (CSS scroll-snap, sin librerías):
 *             2 tarjetas y un pedacito de la tercera, para que se note que sigue.
 *             La fila llega hasta el borde de la pantalla (margen negativo igual
 *             al de STORE_CONTAINER), así la tercera se "corta" contra el borde
 *             y no contra el margen. La página nunca scrollea de costado: el
 *             scroll queda adentro de la fila.
 *   [PC]      4 por vista. Con más de 4, flechas ‹ › al lado de "Ver todos"
 *             (pasan de a 4 y se apagan en los extremos).
 *
 * Las tarjetas llegan armadas desde el servidor (children): este componente
 * solo maneja el deslizamiento y las flechas.
 */
export function ProductStrip({
  id,
  title,
  href,
  children,
}: {
  /** id del título (aria-labelledby de la sección). */
  id: string;
  title: string;
  /** "Ver todos" → el catálogo filtrado. */
  href: string;
  /** Un <li> por producto. */
  children: React.ReactNode[];
}) {
  const trackRef = useRef<HTMLUListElement>(null);
  const reducedMotion = usePrefersReducedMotion();
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);
  const hasArrows = children.length > 4;

  // ¿Se puede ir para atrás o para adelante? (1 px de tolerancia por redondeos)
  const update = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    setCanPrev(track.scrollLeft > 1);
    setCanNext(track.scrollLeft + track.clientWidth < track.scrollWidth - 1);
  }, []);

  useEffect(() => {
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [update]);

  function page(direction: -1 | 1) {
    const track = trackRef.current;
    if (!track) return;
    track.scrollBy({ left: direction * track.clientWidth, behavior: reducedMotion ? "auto" : "smooth" });
  }

  return (
    <section aria-labelledby={id} className="flex flex-col gap-5 md:gap-6">
      <div className="flex items-end justify-between gap-4">
        <h2 id={id} className="font-display text-2xl leading-tight font-semibold tracking-tight md:text-3xl">
          {title}
        </h2>
        <div className="flex shrink-0 items-center gap-3">
          <Link
            href={href}
            className="inline-flex items-center gap-1 rounded-md text-sm font-semibold text-brand underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/30 md:text-[15px]"
          >
            Ver todos
            <ArrowRight aria-hidden className="size-4" />
            <span className="sr-only">: {title}</span>
          </Link>
          {hasArrows && (
            <div className="hidden items-center gap-2 md:flex">
              <ArrowButton label={`${title}: anteriores`} disabled={!canPrev} onClick={() => page(-1)}>
                <ChevronLeft aria-hidden className="size-5" />
              </ArrowButton>
              <ArrowButton label={`${title}: siguientes`} disabled={!canNext} onClick={() => page(1)}>
                <ChevronRight aria-hidden className="size-5" />
              </ArrowButton>
            </div>
          )}
        </div>
      </div>

      <ul
        ref={trackRef}
        onScroll={update}
        className={cn(
          "flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          // Celular/tablet: de borde a borde (mismo margen que STORE_CONTAINER).
          "-mx-4 gap-4 scroll-px-4 px-4 sm:-mx-6 sm:scroll-px-6 sm:px-6",
          // PC: dentro del contenedor, 4 por vista.
          "md:mx-0 md:scroll-px-0 md:gap-6 md:px-0 xl:gap-8",
          // Las tarjetas: 2 y un pedacito de la tercera en el celular; 4 desde tablet.
          "*:w-[calc((100%-2rem)/2.2)] *:shrink-0 *:snap-start",
          "md:*:w-[calc((100%-4.5rem)/4)] xl:*:w-[calc((100%-6rem)/4)]",
          // Espacio para la sombra del hover (si no, overflow la corta).
          "pb-2",
        )}
      >
        {children}
      </ul>
    </section>
  );
}

function ArrowButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-9 items-center justify-center rounded-full border bg-background text-foreground transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/30 disabled:cursor-default disabled:opacity-35 disabled:hover:bg-background"
    >
      {children}
    </button>
  );
}
