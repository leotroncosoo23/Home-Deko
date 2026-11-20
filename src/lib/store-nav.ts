/**
 * Links de la tienda que usan el menú (hamburguesa) y el pie de página.
 * Para sumar una página de información (Cómo comprar, Envíos y retiros,
 * Preguntas frecuentes…), agregarla en INFO_LINKS: aparece en los dos lugares.
 */

export type StoreLink = { label: string; href: string };

/** Catálogo completo. */
export const ALL_PRODUCTS_LINK: StoreLink = { label: "Todos los productos", href: "/productos" };

/** Página de una categoría. */
export function categoryHref(slug: string): string {
  return `/categorias/${slug}`;
}

/** Página de un producto. */
export function productHref(slug: string): string {
  return `/productos/${slug}`;
}

/** Búsqueda (el formulario manda ?q=...). */
export const SEARCH_PATH = "/buscar";

/** Páginas de información y legales. */
export const INFO_LINKS: StoreLink[] = [
  { label: "Términos y condiciones", href: "/terminos" },
  { label: "Política de privacidad", href: "/privacidad" },
];
