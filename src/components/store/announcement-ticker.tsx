"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { cn } from "cn";

/**
 * Barra de anuncios (la franja roja fina de arriba de la tienda).
 * Componente de presentación: lo usan la tienda y la vista previa del panel.
 *
 *   - 1 mensaje        → fijo y centrado.
 *   - 2 o más mensajes → cinta que corre sin fin (marquee). Se pausa al pasar
 *     el mouse o al enfocarla con el teclado (Tab), para poder leer tranquilo.
 *   - Si la persona pidió "reducir movimiento" en su sistema
 *     (prefers-reduced-motion) → en vez de correr, rota un mensaje por vez
 *     con un fundido cada 4 segundos (también se pausa con mouse y foco).
 *
 * La animación de la cinta está en globals.css (@keyframes marquee).
 */
export function AnnouncementTicker({ messages }: { messages: string[] }) {
  const reducedMotion = usePrefersReducedMotion();
  if (messages.length === 0) return null;

  return (
    <div className="bg-brand text-white">
      {messages.length === 1 ? (
        <p className={cn(TEXT, "mx-auto w-full max-w-6xl px-4 py-2 text-center text-balance")}>{messages[0]}</p>
      ) : reducedMotion ? (
        <Rotation messages={messages} />
      ) : (
        <Marquee messages={messages} />
      )}
    </div>
  );
}

const TEXT = "text-[11px] leading-4 font-medium tracking-[0.08em] uppercase sm:text-xs";

// ---------------------------------------------------------------------------
// Cinta que corre
// ---------------------------------------------------------------------------

function Marquee({ messages }: { messages: string[] }) {
  // Velocidad pareja: más texto → más segundos por vuelta (mín. 20 s).
  const chars = messages.join("").length;
  const duration = Math.max(20, Math.round(chars * 0.35));

  // La lista va DOS veces seguidas: la animación la corre la mitad de su
  // ancho (-50 %) y vuelve a empezar, así no se nota el salto.
  const track = (copy: number) => (
    <ul aria-hidden={copy === 1 ? true : undefined} className="flex shrink-0">
      {messages.map((m, i) => (
        <li key={i} className={cn(TEXT, "flex items-center whitespace-nowrap")}>
          <span className="px-8">{m}</span>
          <span aria-hidden className="text-white/60">•</span>
        </li>
      ))}
    </ul>
  );

  return (
    <div
      // Enfocable: con Tab se pausa la cinta (los lectores de pantalla leen la primera copia).
      tabIndex={0}
      role="region"
      aria-label="Anuncios"
      className="group overflow-hidden py-2 outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-inset"
    >
      <div
        className="flex w-max animate-[marquee_linear_infinite] group-hover:[animation-play-state:paused] group-focus-visible:[animation-play-state:paused] motion-reduce:animate-none"
        style={{ animationDuration: `${duration}s` }}
      >
        {track(0)}
        {track(1)}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Rotación con fundido (reducir movimiento)
// ---------------------------------------------------------------------------

const ROTATION_MS = 4000;

function Rotation({ messages }: { messages: string[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % messages.length), ROTATION_MS);
    return () => clearInterval(timer);
  }, [paused, messages.length]);

  return (
    <div
      tabIndex={0}
      role="region"
      aria-label="Anuncios"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="grid px-4 py-2 outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-inset"
    >
      {/* Todos apilados en la misma celda: así la barra no cambia de alto */}
      {messages.map((m, i) => (
        <p
          key={i}
          aria-hidden={i !== index}
          className={cn(
            TEXT,
            "col-start-1 row-start-1 text-center text-balance transition-opacity duration-500",
            i === index ? "opacity-100" : "opacity-0",
          )}
        >
          {m}
        </p>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------

/** ¿La persona pidió "reducir movimiento" en su sistema? (se actualiza en vivo) */
function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia("(prefers-reduced-motion: reduce)");
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    // En el servidor no se sabe: se arma la cinta (y el CSS la frena si hace falta).
    () => false,
  );
}
