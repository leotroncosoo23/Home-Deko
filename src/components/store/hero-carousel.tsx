"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { cn } from "cn";
import { CAROUSEL_INTERVAL_MS } from "@/lib/banners";
import { usePrefersReducedMotion } from "@/lib/use-reduced-motion";

export type CarouselSlide = { key: string; content: React.ReactNode };

/**
 * CARRUSEL del banner principal (2 o 3 banners). Sin librerías:
 *
 *   - El deslizamiento es CSS scroll-snap: en el celular se pasa con el dedo
 *     de forma nativa (con la inercia del sistema), sin JS de por medio.
 *   - El JS solo hace lo demás: pasar solo cada 6 s, flechas (PC), puntitos
 *     y saber cuál se ve (a partir de la posición del scroll).
 *
 * Se pausa:
 *   - al pasar el mouse por encima (solo mouse: en el celular un toque no
 *     dispara un "mouseleave" y quedaría pausado para siempre);
 *   - mientras se lo toca con el dedo (al soltar, vuelve a contar 6 s);
 *   - mientras tiene el foco del teclado (Tab);
 *   - con el botón de pausa (lo piden las pautas de accesibilidad para todo
 *     lo que se mueve solo más de 5 segundos);
 *   - siempre, si la persona pidió "reducir movimiento" (prefers-reduced-motion):
 *     no pasa solo y los cambios son sin animación.
 *
 * Accesibilidad: región con aria-roledescription "carrusel"; cada diapositiva
 * es un grupo "1 de 3". Las que no se ven son "inert" (el Tab no entra en sus
 * links y el lector de pantalla no las lee). Mientras pasa sola, los cambios
 * no se anuncian (aria-live off); pausada, sí (polite). Flechas ← → del
 * teclado cuando el foco está adentro.
 */
export function HeroCarousel({ slides, slideClassName }: { slides: CarouselSlide[]; slideClassName: string }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const count = slides.length;
  const reducedMotion = usePrefersReducedMotion();

  const [active, setActive] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [touching, setTouching] = useState(false);
  const [keyboardFocus, setKeyboardFocus] = useState(false);
  const [stopped, setStopped] = useState(false);

  const autoplay = !reducedMotion && !stopped;
  const running = autoplay && !hovered && !touching && !keyboardFocus;

  const goTo = useCallback(
    (index: number) => {
      const track = trackRef.current;
      if (!track) return;
      const target = (index + count) % count; // del último vuelve al primero
      track.scrollTo({ left: target * track.clientWidth, behavior: reducedMotion ? "auto" : "smooth" });
    },
    [count, reducedMotion],
  );

  // Pasa solo: cada vez que cambia la diapositiva (sola o a mano), cuenta 6 s de nuevo.
  useEffect(() => {
    if (!running) return;
    const timer = window.setTimeout(() => goTo(active + 1), CAROUSEL_INTERVAL_MS);
    return () => window.clearTimeout(timer);
  }, [running, active, goTo]);

  // Cuál se ve: la que ocupa más de la mitad del ancho.
  function handleScroll() {
    const track = trackRef.current;
    if (!track || track.clientWidth === 0) return;
    const index = Math.min(count - 1, Math.max(0, Math.round(track.scrollLeft / track.clientWidth)));
    setActive((current) => (current === index ? current : index));
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      goTo(active - 1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      goTo(active + 1);
    }
  }

  return (
    <section
      aria-roledescription="carrusel"
      aria-label="Destacados"
      className="group/carousel relative"
      onPointerEnter={(e) => e.pointerType === "mouse" && setHovered(true)}
      onPointerLeave={(e) => e.pointerType === "mouse" && setHovered(false)}
      onTouchStart={() => setTouching(true)}
      onTouchEnd={() => setTouching(false)}
      onTouchCancel={() => setTouching(false)}
      // Solo el foco del TECLADO pausa: un clic en una flecha también da foco,
      // y no queremos que quede pausado hasta tocar otra parte de la página.
      onFocus={(e) => {
        if ((e.target as HTMLElement).matches(":focus-visible")) setKeyboardFocus(true);
      }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setKeyboardFocus(false);
      }}
      onKeyDown={handleKeyDown}
    >
      <div
        ref={trackRef}
        onScroll={handleScroll}
        aria-live={running ? "off" : "polite"}
        className={cn(
          "flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain",
          // Sin barra de scroll visible (se pasa con el dedo, las flechas o los puntitos)
          "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        )}
      >
        {slides.map((slide, i) => (
          <div
            key={slide.key}
            role="group"
            aria-roledescription="diapositiva"
            aria-label={`${i + 1} de ${count}`}
            inert={i !== active}
            className={cn("@container w-full shrink-0 snap-start snap-always", slideClassName)}
          >
            {slide.content}
          </div>
        ))}
      </div>

      {/* Flechas: solo en PC (en el celular se desliza con el dedo) */}
      <ArrowButton side="left" label="Banner anterior" onClick={() => goTo(active - 1)} />
      <ArrowButton side="right" label="Banner siguiente" onClick={() => goTo(active + 1)} />

      {/* Puntitos (+ pausa) abajo, sobre el banner */}
      <div className="absolute inset-x-0 bottom-3 flex justify-center md:bottom-4">
        <div className="flex items-center gap-1 rounded-full bg-black/35 px-1.5 py-1 backdrop-blur-sm">
          {!reducedMotion && (
            <button
              type="button"
              onClick={() => setStopped((s) => !s)}
              aria-label={stopped ? "Reanudar el paso automático de los banners" : "Pausar el paso automático de los banners"}
              className="flex size-7 items-center justify-center rounded-full text-white transition-colors hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
            >
              {stopped ? <Play aria-hidden className="size-3.5 fill-current" /> : <Pause aria-hidden className="size-3.5 fill-current" />}
            </button>
          )}
          {slides.map((slide, i) => (
            <button
              key={slide.key}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`Ver banner ${i + 1} de ${count}`}
              aria-current={i === active ? "true" : undefined}
              // 28 px para tocar cómodo; el punto visible es más chico.
              className="group/dot flex size-7 items-center justify-center rounded-full focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
            >
              <span
                aria-hidden
                className={cn(
                  "block h-2 rounded-full bg-white transition-all motion-reduce:transition-none",
                  i === active ? "w-5" : "w-2 opacity-60 group-hover/dot:opacity-100",
                )}
              />
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function ArrowButton({ side, label, onClick }: { side: "left" | "right"; label: string; onClick: () => void }) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        "absolute top-1/2 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-foreground shadow-md transition-[opacity,background-color] hover:bg-white focus-visible:opacity-100 focus-visible:ring-4 focus-visible:ring-white/60 focus-visible:outline-none md:flex",
        // Discretas hasta que se pasa el mouse por el banner
        "opacity-70 group-hover/carousel:opacity-100",
        side === "left" ? "left-4" : "right-4",
      )}
    >
      <Icon aria-hidden className="size-6" />
    </button>
  );
}
