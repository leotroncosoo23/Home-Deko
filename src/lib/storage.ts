/**
 * Imágenes en Supabase Storage.
 *
 * Usamos un solo bucket público, "product-images", con carpetas:
 *   categories/<archivo>.webp   → imágenes de categorías
 *   <product_id>/<archivo>.webp → imágenes de productos (paso 5)
 *
 * En la base se guarda solo la RUTA (ej. "categories/abc.webp"); la URL
 * completa se arma acá. Así, si cambia el dominio, no hay que tocar datos.
 */
export const IMAGES_BUCKET = "product-images";

export function publicImageUrl(path: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${IMAGES_BUCKET}/${path}`;
}
