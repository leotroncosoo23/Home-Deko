/**
 * Links de la tienda que usan el menú (hamburguesa) y el pie de página.
 * Para sumar una página de ayuda, agregarla en HELP_LINKS: aparece en los dos lugares.
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

/** "Iniciar compra" del carrito (en el paso 4, el checkout con Mercado Pago). */
export const CHECKOUT_PATH = "/finalizar-compra";

/** Búsqueda (el formulario manda ?q=...). */
export const SEARCH_PATH = "/buscar";

/** Páginas de ayuda para clientes (textos en src/content/informacion.ts). */
export const HELP_LINKS: StoreLink[] = [
  { label: "Cómo comprar", href: "/como-comprar" },
  { label: "Envíos y retiro", href: "/envios" },
  { label: "Cambios y devoluciones", href: "/cambios-y-devoluciones" },
  { label: "Preguntas frecuentes", href: "/preguntas-frecuentes" },
  { label: "Contacto", href: "/contacto" },
];

/**
 * Páginas legales. Google pide que /privacidad y /terminos se vean en el pie
 * de la página de inicio (verificación de la marca): no quitarlas.
 */
export const LEGAL_LINKS: StoreLink[] = [
  { label: "Términos y condiciones", href: "/terminos" },
  { label: "Política de privacidad", href: "/privacidad" },
];

/**
 * Botón de arrepentimiento (Disposición 954/2025): link "a simple vista, en
 * lugar destacado y en el primer acceso". Va en el pie de todas las páginas,
 * destacado en el menú hamburguesa y en el encabezado de PC. No quitarlo.
 */
export const WITHDRAWAL_LINK: StoreLink = { label: "Botón de arrepentimiento", href: "/arrepentimiento" };

/**
 * Defensa del Consumidor. La Res. 274/2021 (texto "Defensa de las y los
 * Consumidores. Para reclamos ingrese aquí") figura abrogada por la Disp.
 * 890/2025; se mantiene igual porque es buena práctica y no cuesta nada.
 */
export const CONSUMER_DEFENSE_URL = "https://www.argentina.gob.ar/produccion/defensadelconsumidor";
