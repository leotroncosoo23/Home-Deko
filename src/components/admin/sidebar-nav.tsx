"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { HELP_ITEM, NAV_ITEMS, isNavItemActive } from "./nav-items";

type NavProps = {
  onNavigate?: () => void;
  /** Contadores por sección (ej.: { "/admin/stock": 4 } = 4 variantes para reponer). Ver badgeLabel en nav-items.ts. */
  badges?: Record<string, number>;
  /**
   * Qué lista mostrar: las secciones de trabajo ("main") o solo "Ayuda"
   * ("help"), que va aparte, abajo de la barra. Se pasa un texto y no la
   * lista en sí porque los íconos (funciones) no pueden viajar del
   * servidor al cliente.
   */
  list?: "main" | "help";
};

/**
 * Lista de secciones del panel. Se usa en la barra lateral fija (PC) y en
 * el panel deslizable (celular).
 *
 * Es un componente de cliente porque usePathname() (la URL actual) solo
 * existe en el navegador: así la sección activa cambia al instante al navegar.
 *
 * ¿Por qué el <Suspense>? En páginas con partes "dinámicas" en la URL
 * (ej. /admin/productos/[id]), la URL exacta recién se conoce al pedir la
 * página, no cuando Next pre-arma la estructura. Mientras tanto se muestra
 * la misma lista SIN marcar la activa (no se nota: dura un instante).
 *
 * Sección activa (CLAUDE.md: el rojo de marca solo como acento):
 * fondo gris suave, texto en negro de marca, ícono rojo y barrita roja.
 */
export function SidebarNav(props: NavProps) {
  return (
    <Suspense fallback={<NavLinks pathname={null} {...props} />}>
      <ActiveNav {...props} />
    </Suspense>
  );
}

function ActiveNav(props: NavProps) {
  const pathname = usePathname();
  return <NavLinks pathname={pathname} {...props} />;
}

function NavLinks({ pathname, onNavigate, badges, list = "main" }: NavProps & { pathname: string | null }) {
  const items = list === "help" ? [HELP_ITEM] : NAV_ITEMS;
  return (
    <nav aria-label={list === "help" ? "Ayuda" : "Secciones del panel"}>
      <ul className="flex flex-col gap-0.5">
        {items.map((item) => {
          const active = pathname !== null && isNavItemActive(item.href, pathname);
          const Icon = item.icon;
          const badge = badges?.[item.href] ?? 0;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group relative flex h-9 items-center gap-3 rounded-md px-3 text-sm transition-colors",
                  "outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                  active
                    ? "bg-muted font-semibold text-foreground"
                    : "font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )}
              >
                {/* Barrita roja de la sección activa */}
                {active && (
                  <span
                    aria-hidden
                    className="absolute top-1.5 bottom-1.5 left-0 w-0.75 rounded-full bg-brand"
                  />
                )}
                <Icon
                  aria-hidden
                  className={cn(
                    "size-4 shrink-0",
                    active ? "text-brand" : "text-muted-foreground/70 group-hover:text-foreground",
                  )}
                />
                {item.title}
                {badge > 0 && (
                  <span
                    className="ml-auto min-w-5 rounded-full bg-brand-soft px-1.5 py-px text-center text-xs font-semibold text-brand tabular-nums"
                    aria-label={item.badgeLabel?.(badge) ?? String(badge)}
                    title={item.badgeLabel?.(badge)}
                  >
                    {badge > 99 ? "99+" : badge}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
