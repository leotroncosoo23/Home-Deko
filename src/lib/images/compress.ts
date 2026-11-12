/**
 * Comprime una imagen EN EL NAVEGADOR antes de subirla (ver CLAUDE.md).
 *
 * Una foto de celular pesa 3–8 MB; achicada a 1200 px y pasada a WebP
 * queda en ~100–300 KB, se ve igual de bien en la tienda y carga rápido.
 *
 * Cómo: se dibuja la imagen en un <canvas> más chico y se exporta como
 * WebP (o JPG, si el navegador no sabe generar WebP).
 * Solo funciona en el navegador (usa canvas): llamarla desde componentes
 * "use client".
 */
export async function compressImage(
  file: File,
  { maxSize = 1200, quality = 0.82 }: { maxSize?: number; quality?: number } = {},
): Promise<File> {
  let bitmap: ImageBitmap;
  try {
    // createImageBitmap respeta la orientación de las fotos del celular.
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("No se pudo leer la imagen. Probá con un archivo JPG, PNG o WebP.");
  }

  // Achicar solo si es más grande que maxSize (nunca agrandar).
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Tu navegador no pudo procesar la imagen.");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const toBlob = (type: string) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));

  // Si el navegador no genera WebP, toBlob devuelve PNG: en ese caso, JPG.
  let blob = await toBlob("image/webp");
  if (!blob || blob.type !== "image/webp") blob = await toBlob("image/jpeg");
  if (!blob) throw new Error("No se pudo procesar la imagen.");

  const ext = blob.type === "image/webp" ? "webp" : "jpg";
  const baseName = file.name.replace(/\.[^.]+$/, "") || "imagen";
  return new File([blob], `${baseName}.${ext}`, { type: blob.type });
}
