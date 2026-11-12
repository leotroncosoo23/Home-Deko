"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_ITEMS, isNavItemActive } from "./nav-items";

/**
 * Lista de secciones del panel. Se usa en la barra lateral fija (PC) y en
 * el panel deslizable (celular).
 *
 * Es un componente de cliente porque usePathname() (la URL actual) solo
 * existe en el navegador: así la sección activa cambia al instante al navegar.
 *
 * Sección activa (CLAUDE.md: el rojo de marca solo como acento):
 * fondo gris suave, texto en negro de marca, ícono rojo y barrita roja.
 */
export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Secciones del panel">
      <ul className="flex flex-col gap-0.5">
        {NAV_ITEMS.map((item) => {
          const active = isNavItemActive(item.href, pathname);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group relative flex h-9 items-center gap-3 rounded-md px-3 text-sm transition-colors",
                  "outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                  active
                    ? "bg-neutral-100 font-semibold text-foreground"
                    : "font-medium text-muted-foreground hover:bg-neutral-50 hover:text-foreground",
                )}
              >
                {/* Barrita roja de la sección activa */}
                {active && (
                  <span
                    aria-hidden
                    className="absolute top-1.5 bottom-1.5 left-0 w-[3px] rounded-full bg-brand"
                  />
                )}
                <Icon
                  aria-hidden
                  className={cn(
                    "size-4 shrink-0",
                    active ? "text-brand" : "text-neutral-400 group-hover:text-neutral-600",
                  )}
                />
                {item.title}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
