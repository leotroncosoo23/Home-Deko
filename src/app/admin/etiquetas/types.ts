/** Una variante en la cola de etiquetas (vista admin_label_queue). */
export type LabelQueueItem = {
  variantId: string;
  productId: string;
  productName: string;
  /** "Rojo / 300 ml"; null en un producto sin variantes. */
  variantLabel: string | null;
  sku: string | null;
  barcode: string;
  stock: number;
  quantity: number;
  imageUrl: string | null;
};

/** Una variante para elegir en "Agregar a etiquetas". */
export type LabelVariantChoice = {
  variantId: string;
  productId: string;
  productName: string;
  variantLabel: string | null;
  barcode: string;
  stock: number;
  /** Cuántas hay ya en la cola (0 = no está). */
  queued: number;
};

export type LabelActionResult = { ok: true; message: string } | { ok: false; error: string };

/** Topes (los mismos en el navegador y en el servidor). */
export const MAX_PER_VARIANT = 999;
export const MAX_TOTAL_LABELS = 2000;
