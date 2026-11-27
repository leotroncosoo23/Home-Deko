"use client";

import { Suspense, useCallback, useEffect, useId, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Undo2 } from "lucide-react";
import { cn } from "cn";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { StoreCategoryNode } from "@/lib/store-data";
import { STORE_CONTAINER } from "@/lib/store-layout";
import { ALL_PRODUCTS_LINK, categoryHref, HELP_LINKS, WITHDRAWAL_LINK } from "@/lib/store-nav";
import { MegaPanel } from "./mega-menu";

/** Espacio entre links (px). Igual que la clase gap-1 de abajo. */
const GAP = 4;
/** Demora para abrir / cerrar el mega menú con el mouse: no parpadea al pasar. */
const HOVER_DELAY = 150;

/**
 * Barra de categorías del encabezado de ESCRITORIO (desde 1024 px), en el
 * orden de Categorías del panel. Solo PRINCIPALES (con algún producto).
 *
 *   - Principal CON subcategorías: botón que abre el mega menú (mega-menu.tsx)
 *     con hover (150 ms de demora para abrir y cerrar) o clic. Se cierra
 *     con Escape (vuelve el foco al botón), clic afuera, al salir con el
 *     mouse o al navegar. aria-expanded + aria-controls.
 *   - Principal SIN subcategorías: link directo, como siempre.
 *
 * Si no entran todas en una línea, muestra las que entran y suma
 * "Todas las categorías ▾" con la lista completa. Para saber cuántas
 * entran, mide los links en una fila invisible y vuelve a calcular cuando
 * cambia el ancho de la ventana.
 */
export function CategoryBar({ categories }: { categories: StoreCategoryNode[] }) {
  // usePathname (para marcar la categoría actual): en las rutas dinámicas la
  // URL exacta recién se conoce al pedir la página, por eso va en <Suspense>.
  // Mientras tanto, la misma barra sin marcar ninguna (dura un instante).
  return (
    <Suspense fallback={<Bar categories={categories} pathname={null} />}>
      <BarWithPathname categories={categories} />
    </Suspense>
  );
}

function BarWithPathname({ categories }: { categories: StoreCategoryNode[] }) {
  return <Bar categories={categories} pathname={usePathname()} />;
}

function Bar({ categories, pathname }: { categories: StoreCategoryNode[]; pathname: string | null }) {
  const navRef = useRef<HTMLElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLButtonElement>(null);
  const triggerRefs = useRef(new Map<string, HTMLButtonElement>());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panelId = useId();
  // Cuántas categorías se ven en la barra (null = todavía no se midió).
  const [visible, setVisible] = useState<number | null>(null);
  // Mega menú abierto (id de la principal) o null.
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    const measure = measureRef.current;
    if (!container || !measure) return;

    function update() {
      const available = container!.clientWidth;
      // Fila invisible: [Todos los productos, cat1, cat2, …] y el botón "Todas…"
      const widths = Array.from(measure!.children, (el) => (el as HTMLElement).offsetWidth + GAP);
      const [allProducts, ...cats] = widths;
      const total = allProducts + cats.reduce((a, b) => a + b, 0);
      if (total <= available) {
        setVisible(cats.length);
        return;
      }
      const moreWidth = (moreRef.current?.offsetWidth ?? 180) + GAP;
      let used = allProducts + moreWidth;
      let count = 0;
      for (const w of cats) {
        if (used + w > available) break;
        used += w;
        count++;
      }
      setVisible(count);
    }

    const observer = new ResizeObserver(update);
    observer.observe(container);
    return () => observer.disconnect();
  }, [categories]);

  // --- Mega menú --------------------------------------------------------
  const clearTimer = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const later = useCallback(
    (fn: () => void) => {
      clearTimer();
      timer.current = setTimeout(fn, HOVER_DELAY);
    },
    [clearTimer],
  );

  const close = useCallback(() => {
    clearTimer();
    setOpenId(null);
  }, [clearTimer]);

  // Al navegar (cambia la URL), se cierra (ajuste durante el render, sin efecto).
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpenId(null);
  }

  // Escape (devuelve el foco al botón) y clic afuera.
  useEffect(() => {
    if (!openId) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      triggerRefs.current.get(openId!)?.focus();
      close();
    }
    function onPointerDown(e: PointerEvent) {
      if (!navRef.current?.contains(e.target as Node)) close();
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [openId, close]);

  useEffect(() => clearTimer, [clearTimer]);

  const shown = visible ?? categories.length;
  const overflow = shown < categories.length;
  const openCategory = categories.find((c) => c.id === openId) ?? null;
  const isActive = (c: StoreCategoryNode) =>
    pathname !== null && (pathname === categoryHref(c.slug) || pathname.startsWith(`${categoryHref(c.slug)}/`));

  return (
    <nav ref={navRef} aria-label="Categorías" className="relative border-t" onPointerLeave={() => openId && later(close)}>
      {/* -ml-3 en la fila: el texto del primer link queda alineado con el logo (cada link tiene px-3) */}
      <div className={cn(STORE_CONTAINER, "flex h-12 items-center")}>
        <div ref={containerRef} className="relative -ml-3 flex min-w-0 flex-1 items-center">
          {/* Fila para medir (invisible, no se puede tocar ni la lee el lector de pantalla) */}
          <div ref={measureRef} aria-hidden inert className="pointer-events-none invisible absolute flex whitespace-nowrap">
            <BarItemLook label={ALL_PRODUCTS_LINK.label} />
            {categories.map((c) => (
              <BarItemLook key={c.id} label={c.name} chevron={c.children.length > 0} />
            ))}
          </div>

          <ul className={cn("flex min-w-0 items-center gap-1 overflow-hidden whitespace-nowrap", visible === null && "invisible")}>
            <li>
              <BarLink href={ALL_PRODUCTS_LINK.href} label={ALL_PRODUCTS_LINK.label} active={pathname === ALL_PRODUCTS_LINK.href} />
            </li>
            {categories.slice(0, shown).map((c) =>
              c.children.length > 0 ? (
                <li key={c.id}>
                  <button
                    type="button"
                    ref={(el) => {
                      if (el) triggerRefs.current.set(c.id, el);
                      else triggerRefs.current.delete(c.id);
                    }}
                    aria-expanded={openId === c.id}
                    aria-controls={openId === c.id ? panelId : undefined}
                    onClick={() => {
                      clearTimer();
                      setOpenId((id) => (id === c.id ? null : c.id));
                    }}
                    onPointerEnter={(e) => {
                      if (e.pointerType !== "mouse") return;
                      // Con otro panel abierto, cambia enseguida; si no, con demora.
                      if (openId) {
                        clearTimer();
                        setOpenId(c.id);
                      } else later(() => setOpenId(c.id));
                    }}
                    onPointerLeave={(e) => {
                      if (e.pointerType === "mouse" && !openId) clearTimer();
                    }}
                    className={cn(
                      barItemClass(isActive(c) || openId === c.id),
                      openId === c.id && "bg-muted",
                    )}
                  >
                    {c.name}
                    <ChevronDown
                      aria-hidden
                      className={cn("ml-1 size-3.5 transition-transform duration-200", openId === c.id && "rotate-180")}
                    />
                    {isActive(c) && <ActiveLine />}
                  </button>
                </li>
              ) : (
                <li key={c.id} onPointerEnter={() => openId && later(close)}>
                  <BarLink href={categoryHref(c.slug)} label={c.name} active={isActive(c)} />
                </li>
              ),
            )}
          </ul>

          {/* "Todas las categorías": solo si no entran todas. Se renderiza siempre
              (invisible) para poder medir su ancho. */}
          <DropdownMenu>
            <DropdownMenuTrigger
              ref={moreRef}
              className={cn(
                "ml-1 inline-flex h-9 shrink-0 items-center gap-1 rounded-full px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/20 focus-visible:outline-none",
                !overflow && "pointer-events-none invisible",
              )}
              tabIndex={overflow ? undefined : -1}
              aria-hidden={overflow ? undefined : true}
            >
              Todas las categorías
              <ChevronDown aria-hidden className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="max-h-[70vh] w-64 overflow-y-auto p-1.5">
              <DropdownMenuItem render={<Link href={ALL_PRODUCTS_LINK.href} />} className="h-9 font-medium">
                {ALL_PRODUCTS_LINK.label}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {categories.map((c) => (
                <div key={c.id}>
                  <DropdownMenuItem render={<Link href={categoryHref(c.slug)} />} className="gap-3 py-1.5 font-medium">
                    <span className="relative size-8 shrink-0 overflow-hidden rounded-md bg-muted">
                      {c.imageUrl && <Image src={c.imageUrl} alt="" fill sizes="32px" className="object-cover" />}
                    </span>
                    {c.name}
                  </DropdownMenuItem>
                  {c.children.map((s) => (
                    <DropdownMenuItem
                      key={s.id}
                      render={<Link href={categoryHref(c.slug, s.slug)} />}
                      className="h-8 pl-13 text-muted-foreground"
                    >
                      {s.name}
                    </DropdownMenuItem>
                  ))}
                </div>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* A la derecha: Ayuda ▾ y el Botón de arrepentimiento (Disp. 954/2025:
            a simple vista desde el primer acceso). Fuera del contenedor medido. */}
        <div className="ml-4 flex shrink-0 items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex h-9 items-center gap-1 rounded-full px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/20 focus-visible:outline-none">
              Ayuda
              <ChevronDown aria-hidden className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 p-1.5">
              {HELP_LINKS.map((l) => (
                <DropdownMenuItem key={l.href} render={<Link href={l.href} />} className="h-9">
                  {l.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Link
            href={WITHDRAWAL_LINK.href}
            aria-current={pathname === WITHDRAWAL_LINK.href ? "page" : undefined}
            className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-brand transition-colors hover:bg-brand-soft focus-visible:ring-3 focus-visible:ring-ring/20 focus-visible:outline-none"
          >
            <Undo2 aria-hidden className="size-4" />
            {WITHDRAWAL_LINK.label}
          </Link>
        </div>
      </div>

      {openCategory && (
        <MegaPanel
          id={panelId}
          category={openCategory}
          onNavigate={close}
          onPointerEnter={clearTimer}
          onPointerLeave={() => later(close)}
        />
      )}
    </nav>
  );
}

function barItemClass(active: boolean) {
  return cn(
    "relative inline-flex h-9 items-center rounded-full px-3 text-sm font-medium transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/20 focus-visible:outline-none",
    active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
  );
}

/** Categoría actual: subrayado rojo fino. */
function ActiveLine() {
  return <span aria-hidden className="absolute inset-x-3 -bottom-0.5 h-0.5 rounded-full bg-brand" />;
}

function BarLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link href={href} aria-current={active ? "page" : undefined} className={barItemClass(active)}>
      {label}
      {active && <ActiveLine />}
    </Link>
  );
}

/** Mismo ancho que un link o botón de la barra (para medir cuántos entran). */
function BarItemLook({ label, chevron = false }: { label: string; chevron?: boolean }) {
  return (
    <span className={barItemClass(false)}>
      {label}
      {chevron && <ChevronDown aria-hidden className="ml-1 size-3.5" />}
    </span>
  );
}
