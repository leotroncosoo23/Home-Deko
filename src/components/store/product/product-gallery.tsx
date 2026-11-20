"use client";

import { useCallback, useRef, useState } from "react";
import Image from "next/image";
import { Dialog } from "@base-ui/react/dialog";
import { ChevronLeft, ChevronRight, X, ZoomIn } from "lucide-react";
import type { ProductPhoto } from "@/lib/store-data";
import { cn } from "@/lib/utils";
import { NoPhoto } from "../product-card";

/** Ancho real de la foto principal (así next/image baja el tamaño justo). */
const MAIN_SIZES = "(min-width: 1440px) 680px, (min-width: 1024px) 48vw, 100vw";

/**
 * Galería de la página de producto.
 *
 *   Celular / tablet: las fotos se deslizan con el dedo (scroll-snap del
 *   navegador, sin librerías) y abajo hay puntitos.
 *   PC: miniaturas a la izquierda y la foto grande; al pasar el mouse, la
 *   foto se agranda siguiendo el puntero (lupa).
 *   En los dos: tocar o hacer clic abre la foto a pantalla completa.
 *
 * La foto que se ve lleva data-gallery-main: desde ahí vuela la miniatura
 * al carrito.
 */
export function ProductGallery({
  photos,
  name,
  badges,
}: {
  /** Ya ordenadas: primero las del color elegido. */
  photos: ProductPhoto[];
  name: string;
  /** Etiquetas sobre la foto ("-10%", "Sin stock"…). */
  badges: React.ReactNode;
}) {
  const [index, setIndex] = useState(0);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  if (photos.length === 0) {
    return (
      <div data-gallery-main className="relative aspect-square overflow-hidden rounded-2xl bg-muted">
        <NoPhoto />
        <div className="absolute top-3 left-3">{badges}</div>
      </div>
    );
  }

  const alt = (p: ProductPhoto, i: number) =>
    p.alt || (photos.length > 1 ? `${name}, foto ${i + 1} de ${photos.length}` : name);

  function goTo(i: number) {
    setIndex(i);
    const el = scroller.current;
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  }

  return (
    <div className="flex flex-col gap-3">
      {/* ---------- Celular / tablet: deslizar ---------- */}
      <div className="relative lg:hidden">
        <div
          ref={scroller}
          onScroll={(e) => {
            const el = e.currentTarget;
            const i = Math.round(el.scrollLeft / el.clientWidth);
            if (i !== index) setIndex(i);
          }}
          className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain rounded-2xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-roledescription="carrusel"
          aria-label={`Fotos de ${name}`}
        >
          {photos.map((p, i) => (
            <button
              key={p.url}
              type="button"
              data-gallery-main={i === index ? "" : undefined}
              onClick={() => setLightbox(i)}
              aria-label={`Ampliar foto ${i + 1} de ${photos.length}`}
              className="relative aspect-square w-full shrink-0 snap-center bg-muted"
            >
              <Image
                src={p.url}
                alt={alt(p, i)}
                fill
                sizes={MAIN_SIZES}
                preload={i === 0}
                className="object-cover"
              />
            </button>
          ))}
        </div>
        <div className="pointer-events-none absolute top-3 left-3">{badges}</div>
        {photos.length > 1 && (
          <div className="mt-3 flex justify-center gap-1.5">
            {photos.map((p, i) => (
              <button
                key={p.url}
                type="button"
                onClick={() => goTo(i)}
                aria-label={`Ver foto ${i + 1} de ${photos.length}`}
                aria-current={i === index}
                // Área de toque de 24 px con el puntito chico adentro.
                className="flex size-6 items-center justify-center"
              >
                <span
                  className={cn(
                    "block h-1.5 rounded-full transition-all",
                    i === index ? "w-5 bg-foreground" : "w-1.5 bg-foreground/25",
                  )}
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ---------- PC: miniaturas + foto grande con lupa ---------- */}
      <div className={cn("hidden gap-4 lg:grid", photos.length > 1 && "lg:grid-cols-[76px_minmax(0,1fr)]")}>
        {photos.length > 1 && (
          <ul className="flex max-h-[680px] flex-col gap-3 overflow-y-auto [scrollbar-width:thin]" aria-label="Fotos">
            {photos.map((p, i) => (
              <li key={p.url}>
                <button
                  type="button"
                  onClick={() => setIndex(i)}
                  onMouseEnter={() => setIndex(i)}
                  aria-label={`Ver foto ${i + 1} de ${photos.length}`}
                  aria-current={i === index}
                  className={cn(
                    "relative block aspect-square w-full overflow-hidden rounded-lg bg-muted ring-offset-2 transition focus-visible:ring-3 focus-visible:ring-ring/30 focus-visible:outline-none",
                    i === index ? "ring-2 ring-foreground" : "opacity-70 hover:opacity-100",
                  )}
                >
                  <Image src={p.url} alt="" fill sizes="76px" className="object-cover" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <ZoomImage
          photo={photos[Math.min(index, photos.length - 1)]}
          alt={alt(photos[Math.min(index, photos.length - 1)], index)}
          onOpen={() => setLightbox(index)}
          badges={badges}
        />
      </div>

      {lightbox !== null && (
        <Lightbox photos={photos} name={name} start={lightbox} onClose={() => setLightbox(null)} alt={alt} />
      )}
    </div>
  );
}

/** Centra la ampliación donde está el puntero (en % de la foto). */
function zoomOrigin(el: HTMLElement, clientX: number, clientY: number) {
  const r = el.getBoundingClientRect();
  el.style.transformOrigin = `${((clientX - r.left) / r.width) * 100}% ${((clientY - r.top) / r.height) * 100}%`;
}

/** Foto grande de PC: con el mouse encima se agranda 2× siguiendo el puntero. */
function ZoomImage({
  photo,
  alt,
  onOpen,
  badges,
}: {
  photo: ProductPhoto;
  alt: string;
  onOpen: () => void;
  badges: React.ReactNode;
}) {
  const img = useRef<HTMLImageElement>(null);

  function move(e: React.PointerEvent<HTMLButtonElement>) {
    if (e.pointerType !== "mouse" || !img.current) return;
    zoomOrigin(img.current, e.clientX, e.clientY);
    img.current.style.transform = "scale(2)";
  }
  function leave() {
    if (img.current) img.current.style.transform = "";
  }

  return (
    <button
      type="button"
      data-gallery-main
      onClick={onOpen}
      onPointerMove={move}
      onPointerLeave={leave}
      aria-label="Ver la foto en pantalla completa"
      className="group/zoom relative aspect-square w-full cursor-zoom-in overflow-hidden rounded-2xl bg-muted focus-visible:ring-3 focus-visible:ring-ring/30 focus-visible:outline-none"
    >
      <Image
        ref={img}
        key={photo.url}
        src={photo.url}
        alt={alt}
        fill
        sizes={MAIN_SIZES}
        preload
        className="object-cover transition-transform duration-200 ease-out motion-reduce:transition-none"
      />
      <span className="pointer-events-none absolute top-3 left-3">{badges}</span>
      <span className="pointer-events-none absolute right-3 bottom-3 inline-flex size-9 items-center justify-center rounded-full bg-background/90 text-foreground opacity-0 shadow-sm transition-opacity group-hover/zoom:opacity-100">
        <ZoomIn aria-hidden className="size-4" />
      </span>
    </button>
  );
}

/**
 * Fotos a pantalla completa. Se deslizan (celular) o se pasan con las
 * flechas (PC y teclado ← →). En PC, un clic agranda la foto 2× y el
 * mouse la recorre; en el celular se puede ampliar con dos dedos.
 */
function Lightbox({
  photos,
  name,
  start,
  onClose,
  alt,
}: {
  photos: ProductPhoto[];
  name: string;
  /** Foto con la que abre. */
  start: number;
  onClose: () => void;
  alt: (p: ProductPhoto, i: number) => string;
}) {
  const [current, setCurrent] = useState(start);
  const [zoomed, setZoomed] = useState(false);
  const track = useRef<HTMLDivElement | null>(null);

  // Al abrir: se posiciona en la foto tocada, sin animación. useCallback:
  // así React lo llama una sola vez (y no vuelve a la primera en cada cambio).
  const attach = useCallback(
    (el: HTMLDivElement | null) => {
      track.current = el;
      if (el) el.scrollLeft = start * el.clientWidth;
    },
    [start],
  );

  function goTo(i: number) {
    const el = track.current;
    if (!el) return;
    const next = (i + photos.length) % photos.length;
    setZoomed(false);
    el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
  }

  function pan(e: React.PointerEvent<HTMLImageElement>) {
    if (zoomed && e.pointerType === "mouse") zoomOrigin(e.currentTarget, e.clientX, e.clientY);
  }

  return (
    // Se monta solo mientras está abierta (así arranca siempre en la foto tocada).
    <Dialog.Root
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Popup
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") goTo(current + 1);
            if (e.key === "ArrowLeft") goTo(current - 1);
          }}
          className="fixed inset-0 z-50 flex flex-col bg-background outline-none data-ending-style:opacity-0 data-starting-style:opacity-0 motion-safe:transition-opacity motion-safe:duration-150"
        >
          <div className="flex h-14 shrink-0 items-center justify-between px-4">
            <Dialog.Title className="text-sm text-muted-foreground tabular-nums">
              <span className="sr-only">{name}: </span>
              {photos.length > 1 ? `${current + 1} / ${photos.length}` : "Foto"}
            </Dialog.Title>
            <Dialog.Close
              aria-label="Cerrar"
              className="inline-flex size-10 items-center justify-center rounded-full transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/30 focus-visible:outline-none"
            >
              <X aria-hidden className="size-5" />
            </Dialog.Close>
          </div>

          <div className="relative min-h-0 flex-1">
            <div
              ref={attach}
              onScroll={(e) => {
                const el = e.currentTarget;
                const i = Math.round(el.scrollLeft / el.clientWidth);
                if (i !== current) {
                  setCurrent(i);
                  setZoomed(false);
                }
              }}
              className={cn(
                "flex h-full snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
                zoomed ? "overflow-hidden" : "overflow-x-auto",
              )}
            >
              {photos.map((p, i) => (
                <div key={p.url} className="relative h-full w-full shrink-0 snap-center overflow-hidden">
                  <Image
                    src={p.url}
                    alt={alt(p, i)}
                    fill
                    sizes="100vw"
                    quality={85}
                    onClick={(e) => {
                      // En el celular se amplía con dos dedos; el clic es para el mouse.
                      if (window.matchMedia("(pointer: coarse)").matches) return;
                      zoomOrigin(e.currentTarget, e.clientX, e.clientY);
                      setZoomed((z) => !z);
                    }}
                    onPointerMove={pan}
                    className={cn(
                      "object-contain transition-transform duration-200 motion-reduce:transition-none",
                      i === current && zoomed ? "scale-[2.2] cursor-zoom-out" : "pointer-fine:cursor-zoom-in",
                    )}
                  />
                </div>
              ))}
            </div>

            {photos.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => goTo(current - 1)}
                  aria-label="Foto anterior"
                  className="absolute top-1/2 left-4 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full bg-background/90 shadow-md transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/30 focus-visible:outline-none lg:inline-flex"
                >
                  <ChevronLeft aria-hidden className="size-5" />
                </button>
                <button
                  type="button"
                  onClick={() => goTo(current + 1)}
                  aria-label="Foto siguiente"
                  className="absolute top-1/2 right-4 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full bg-background/90 shadow-md transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/30 focus-visible:outline-none lg:inline-flex"
                >
                  <ChevronRight aria-hidden className="size-5" />
                </button>
              </>
            )}
          </div>
          <div className="h-[max(1rem,env(safe-area-inset-bottom))] shrink-0" />
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
