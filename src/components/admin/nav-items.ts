import { Boxes, House, LayoutGrid, Package, Tag, type LucideIcon } from "lucide-react";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  /** Frase corta que se muestra debajo del título de cada página. */
  description: string;
};

/**
 * Secciones del panel. Para agregar una sección nueva:
 *   1. Agregarla acá.
 *   2. Crear su página en src/app/admin/<ruta>/page.tsx.
 */
export const NAV_ITEMS: NavItem[] = [
  {
    title: "Inicio",
    href: "/admin",
    icon: House,
    description: "Resumen del negocio: ventas recientes y productos con poco stock.",
  },
  {
    title: "Productos",
    href: "/admin/productos",
    icon: Package,
    description: "Cargá, editá y publicá los productos de la tienda.",
  },
  {
    title: "Categorías",
    href: "/admin/categorias",
    icon: LayoutGrid,
    description: "Organizá los productos en categorías y definí su orden.",
  },
  {
    title: "Etiquetas",
    href: "/admin/etiquetas",
    icon: Tag,
    description: "Prepará e imprimí etiquetas con código de barras en hojas A4.",
  },
  {
    title: "Stock",
    href: "/admin/stock",
    icon: Boxes,
    description: "Ajustá el stock y revisá el historial de movimientos.",
  },
];

/** Busca la sección por su ruta (para títulos y descripciones). */
export function getNavItem(href: string): NavItem {
  const item = NAV_ITEMS.find((i) => i.href === href);
  if (!item) throw new Error(`No existe la sección ${href} en NAV_ITEMS`);
  return item;
}

/**
 * ¿Está activa esta sección?
 * "Inicio" (/admin) solo si la ruta es exactamente /admin; el resto también
 * en sus subpáginas (ej.: /admin/productos/nuevo marca "Productos").
 */
export function isNavItemActive(href: string, pathname: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}
