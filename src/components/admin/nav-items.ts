import {
  Boxes,
  CircleHelp,
  ExternalLink,
  Palette,
  House,
  LayoutGrid,
  Package,
  Settings,
  ShoppingBag,
  Tag,
  TicketPercent,
  type LucideIcon,
} from "lucide-react";

/**
 * Secciones reservadas: solo aparecen si la base da permiso (getPanelAccess
 * en src/lib/auth.ts). Hoy: "appearance" (Apariencia de la tienda), solo para el
 * desarrollador.
 */
export type PanelFeature = "appearance";

/** Permisos de secciones reservadas que llegan del servidor. */
export type NavAccess = Partial<Record<PanelFeature, boolean>>;

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  /** Frase corta que se muestra debajo del título de cada página. */
  description: string;
  /**
   * Grupo del menú (arquitectura del CLAUDE.md: Ventas, Catálogo, Inventario,
   * Análisis). Se muestra en rojo de marca arriba del título de la página.
   */
  group?: string;
  /** Qué significa el contador de la sección (para el lector de pantalla y el tooltip). */
  badgeLabel?: (n: number) => string;
  /** Sección reservada: solo se muestra con ese permiso. */
  feature?: PanelFeature;
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
    description: "Cómo viene la tienda online: lo que requiere atención, las ventas y las visitas.",
  },
  {
    title: "Pedidos",
    href: "/admin/pedidos",
    icon: ShoppingBag,
    group: "Ventas",
    description: "Prepará, despachá y seguí los pedidos de la tienda online.",
    badgeLabel: (n) => (n === 1 ? "1 pedido requiere atención" : `${n} pedidos requieren atención`),
  },
  {
    title: "Cupones",
    href: "/admin/cupones",
    icon: TicketPercent,
    group: "Ventas",
    description: "Creá códigos de descuento para la tienda online y mirá cuánto se usan.",
  },
  {
    title: "Productos",
    href: "/admin/productos",
    icon: Package,
    group: "Catálogo",
    description: "Cargá, editá y publicá los productos de la tienda.",
  },
  {
    title: "Categorías",
    href: "/admin/categorias",
    icon: LayoutGrid,
    group: "Catálogo",
    description: "Organizá los productos en categorías y definí su orden.",
  },
  {
    title: "Etiquetas",
    href: "/admin/etiquetas",
    icon: Tag,
    group: "Inventario",
    description: "Prepará e imprimí etiquetas con código de barras en hojas A4.",
    badgeLabel: (n) => (n === 1 ? "1 etiqueta en la cola" : `${n} etiquetas en la cola`),
  },
  {
    title: "Stock",
    href: "/admin/stock",
    icon: Boxes,
    group: "Inventario",
    description: "Ajustá el stock y revisá el historial de movimientos.",
    badgeLabel: (n) => (n === 1 ? "1 variante para reponer" : `${n} variantes para reponer`),
  },
  {
    title: "Apariencia de la tienda",
    href: "/admin/apariencia",
    icon: Palette,
    group: "Tienda online",
    feature: "appearance",
    description: "La barra de anuncios y el banner principal del inicio.",
  },
];

/** Configuración de la tienda (datos del comercio, redes, envío y lanzamiento). */
export const SETTINGS_ITEM: NavItem = {
  title: "Configuración",
  href: "/admin/configuracion",
  icon: Settings,
  description: "Datos del comercio, redes, envío y el lanzamiento de la tienda.",
};

/**
 * "Ayuda" va aparte, abajo de todo en la barra lateral (separada de las
 * secciones de trabajo). Los textos de la ayuda están en src/content/ayuda.ts.
 */
export const HELP_ITEM: NavItem = {
  title: "Ayuda",
  href: "/admin/ayuda",
  icon: CircleHelp,
  description: "Paso a paso de cada sección, preguntas frecuentes y contacto.",
};

/** Lo que va abajo de todo en el menú: Configuración y Ayuda (+ "Ver tienda"). */
export const BOTTOM_ITEMS: NavItem[] = [SETTINGS_ITEM, HELP_ITEM];

/** "Ver tienda": abre la tienda en otra pestaña (no es una sección del panel). */
export const STORE_LINK = { title: "Ver tienda", href: "/", icon: ExternalLink };

/** ¿Se muestra esta sección con estos permisos? (las reservadas, solo con permiso) */
export function isNavItemVisible(item: NavItem, access?: NavAccess): boolean {
  return !item.feature || access?.[item.feature] === true;
}

/** Busca la sección por su ruta (para títulos y descripciones). */
export function getNavItem(href: string): NavItem {
  const item = [...NAV_ITEMS, ...BOTTOM_ITEMS].find((i) => i.href === href);
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
