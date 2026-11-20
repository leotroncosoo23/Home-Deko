/**
 * Ancho y márgenes de la TIENDA: un solo lugar para que el encabezado, la
 * barra de categorías, el contenido de cada página y el pie queden
 * alineados con el logo.
 *
 *   máximo 1440 px · márgenes laterales 16 px (celular) / 24 px (tablet) / 40 px (PC)
 *
 * Si se cambia acá, revisar también el texto del banner con foto
 * (hero-banner.tsx), que calcula ese mismo borde con una container query.
 */
export const STORE_CONTAINER = "mx-auto w-full max-w-[1440px] px-4 sm:px-6 lg:px-10";
