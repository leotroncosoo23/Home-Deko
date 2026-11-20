/**
 * Etiquetas de la caché de la TIENDA.
 *
 * Las páginas públicas leen sus datos con "use cache" (src/lib/store-data.ts)
 * para ser rápidas. Cuando el panel cambia algo, la Server Action llama a
 * updateTag(<etiqueta>) y la tienda muestra el dato nuevo en el próximo pedido.
 *
 *   Productos y stock → STORE_PRODUCTS_TAG  (destacados, catálogo, búsqueda, "Sin stock", precios)
 *   Categorías        → STORE_CATEGORIES_TAG (menú, grilla del inicio y filtro del catálogo)
 *                       + STORE_PRODUCTS_TAG al editarla u ocultarla (cambia la búsqueda
 *                       y oculta sus productos)
 *   Banners           → STORE_BANNERS_TAG    (banner principal)
 *   Barra de anuncios → STORE_ANNOUNCEMENTS_TAG
 */
export const STORE_PRODUCTS_TAG = "store-products";
export const STORE_CATEGORIES_TAG = "store-categories";
export const STORE_BANNERS_TAG = "store-banners";
export const STORE_ANNOUNCEMENTS_TAG = "store-announcements";
