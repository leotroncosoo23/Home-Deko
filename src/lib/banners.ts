import { publicImageUrl } from "@/lib/storage";

/**
 * Banner principal del inicio (tabla banners). Lo comparten la tienda y el
 * panel: la vista previa del panel usa el MISMO componente que la tienda
 * (src/components/store/hero-banner.tsx), así lo que ven al editar es
 * exactamente lo que va a salir.
 */

export type BannerKind = "template" | "image";
export type BannerBackground = "red" | "white";

/** Lo que necesita el componente para dibujar el banner (URLs ya armadas). */
export type BannerView = {
  kind: BannerKind;
  /** Título de la plantilla. En las imágenes completas: texto alternativo. */
  title: string;
  body: string | null;
  buttonLabel: string | null;
  buttonUrl: string | null;
  background: BannerBackground;
  /** Foto de producto de la plantilla. */
  productImageUrl: string | null;
  /** Imagen completa para PC. */
  imageUrl: string | null;
  /** Imagen completa para celular (si falta, se usa la de PC). */
  imageMobileUrl: string | null;
};

/** Columnas de la tabla que usa la tienda para dibujar el banner. */
export const BANNER_VIEW_COLUMNS =
  "kind, title, body, button_label, button_url, background, product_image_path, image_path, image_mobile_path";

type BannerRow = {
  kind: string;
  title: string;
  body: string | null;
  button_label: string | null;
  button_url: string | null;
  background: string;
  product_image_path: string | null;
  image_path: string | null;
  image_mobile_path: string | null;
};

export function toBannerView(row: BannerRow): BannerView {
  const url = (path: string | null) => (path ? publicImageUrl(path) : null);
  return {
    kind: row.kind === "image" ? "image" : "template",
    title: row.title,
    body: row.body,
    buttonLabel: row.button_label,
    buttonUrl: row.button_url,
    background: row.background === "white" ? "white" : "red",
    productImageUrl: url(row.product_image_path),
    imageUrl: url(row.image_path),
    imageMobileUrl: url(row.image_mobile_path),
  };
}

/** true si el link sale de la tienda (se abre en otra pestaña). */
export function isExternalUrl(url: string): boolean {
  return url.startsWith("https://");
}
