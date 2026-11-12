/**
 * Tipos de Productos, compartidos entre servidor y navegador.
 *
 * Hay dos "formas" de un producto:
 *   - ProductFormValues: lo que maneja el FORMULARIO mientras se edita.
 *     Los montos y cantidades son texto ("12.345,50"), tal como se tipean.
 *   - ProductInput (en schema.ts): lo que viaja a la Server Action, ya con
 *     números de verdad y validado con zod.
 */

export type ProductStatus = "draft" | "active" | "archived";

export const STATUS_LABELS: Record<ProductStatus, string> = {
  draft: "Borrador",
  active: "Publicado",
  archived: "Archivado",
};

/** Un valor de una opción ("Rojo", "12x30 cm"). */
export type FormOptionValue = {
  /** Clave del formulario: el id si ya existe, o una provisoria si es nuevo. */
  key: string;
  id: string | null;
  value: string;
  colorHex: string | null;
};

/** Una opción ("Color", "Medida") con sus valores. */
export type FormOption = {
  key: string;
  id: string | null;
  name: string;
  values: FormOptionValue[];
};

/** Una variante (combinación) tal como la ve el formulario. */
export type FormVariant = {
  /** "default" en un producto simple; si no, las claves de sus valores. */
  key: string;
  id: string | null;
  valueKeys: string[];
  sku: string;
  price: string;
  costPrice: string;
  minStock: string;
  /** Solo para variantes nuevas (las existentes usan "Ajustar stock"). */
  initialStock: string;
  /** Datos de solo lectura de una variante ya guardada. */
  stock: number | null;
  barcode: string | null;
  /** Nombre con el que estaba guardada ("Rojo / 300 ml"), para los avisos. */
  savedLabel?: string;
};

/**
 * Una imagen del producto (parte 5C). La PRIMERA de la lista es la
 * principal (la que se ve en la tienda y en los listados).
 */
export type FormImage = {
  /** Identificador para la pantalla (no cambia al subir). */
  uid: string;
  /** Ruta en Storage ("<id-producto>/<archivo>.webp"); vacía mientras sube. */
  storagePath: string;
  /** URL pública (vacía mientras sube). */
  url: string;
  /** Vista previa local ("blob:") mientras sube. */
  previewUrl: string | null;
  uploading: boolean;
  error: string | null;
  /** Clave del valor de la opción Color al que corresponde (o null). */
  colorValueKey: string | null;
};

/** Descuento (parte 5D). Fechas en formato "AAAA-MM-DD" (o vacías). */
export type FormDiscount = {
  type: "percent" | "fixed";
  value: string;
  startsOn: string;
  endsOn: string;
};

export type ProductFormValues = {
  /** null hasta que se necesita (al guardar o al subir la primera foto). */
  id: string | null;
  isNew: boolean;
  /** Cuándo se cargó: para avisar si otra persona lo cambió mientras tanto. */
  expectedUpdatedAt: string | null;
  name: string;
  slug: string;
  description: string;
  categoryId: string | null;
  basePrice: string;
  costPrice: string;
  status: ProductStatus;
  isFeatured: boolean;
  hasVariants: boolean;
  options: FormOption[];
  variants: FormVariant[];
  images: FormImage[];
  discount: FormDiscount | null;

  // --- Solo del formulario (no viajan al servidor) ---
  /** Combinaciones que quitaste a mano ("no existe Rojo / 500 ml"). */
  excludedKeys: string[];
  /** Variantes tal como estaban guardadas (para avisar si se quita una con stock). */
  savedVariants: FormVariant[];
  /** Lo que había antes de prender/apagar "tiene variantes" (para no perderlo). */
  stashedSimple: FormVariant | null;
  stashedVariants: { options: FormOption[]; variants: FormVariant[]; excludedKeys: string[] } | null;
};

/** Una categoría para el selector. */
export type CategoryChoice = { id: string; name: string; isVisible: boolean };

/** Fila de la lista mínima de productos. */
export type StockStatus = "ok" | "low" | "out";

export type ProductListItem = {
  id: string;
  name: string;
  status: ProductStatus;
  categoryName: string | null;
  imageUrl: string | null;
  /** Precio mínimo y máximo entre las variantes activas (sin descuento). */
  minPrice: number;
  maxPrice: number;
  /** Con el descuento, si hoy está vigente (si no, igual a min/max). */
  finalMinPrice: number;
  finalMaxPrice: number;
  discountActive: boolean;
  variantCount: number;
  hasVariants: boolean;
  totalStock: number;
  stockStatus: StockStatus;
  /** Tuvo movimientos de stock además del "inicial" → no se puede eliminar. */
  hasHistory: boolean;
};

/** Una página del listado. */
export type ProductListPage = {
  items: ProductListItem[];
  /** Total de productos con los filtros (todas las páginas). */
  total: number;
  /** Página que se está mostrando (puede corregirse si pedían una que no existe). */
  page: number;
  pageCount: number;
};

/** Resultado de las acciones del listado. */
export type ListActionResult =
  | { ok: true; message: string }
  | { ok: false; error: string; canArchive?: boolean };

/** Código de una variante, para la tarjeta "Códigos" al editar. */
export type VariantCode = {
  id: string;
  label: string;
  sku: string | null;
  barcode: string;
  stock: number;
};

/** Errores del formulario: clave = campo ("name", "variants.0.sku"…). */
export type FormErrors = Record<string, string>;

/**
 * Cambio de campos: un objeto con los campos nuevos, o una función que
 * recibe los valores MÁS RECIENTES (necesaria cuando el cambio llega más
 * tarde, ej.: al terminar de subir una foto mientras se editaba otra cosa).
 */
export type FormUpdate = (
  patch: Partial<ProductFormValues> | ((current: ProductFormValues) => Partial<ProductFormValues>),
) => void;

/** Lo que recibe cada tarjeta del formulario. */
export type FormCardProps = {
  values: ProductFormValues;
  /** Cambia algunos campos (los demás quedan igual). */
  update: FormUpdate;
  errors: FormErrors;
  disabled: boolean;
  /**
   * Stock ACTUAL de cada variante guardada (id → stock), que llega aparte
   * de los datos del formulario: así, al ajustar el stock, los números se
   * actualizan sin borrar lo que se está editando. Vacío en un producto nuevo.
   */
  liveStock: Record<string, number>;
};

export type UploadImageResult =
  | { ok: true; storagePath: string; url: string }
  | { ok: false; error: string };

export type SaveProductResult =
  | { ok: true; id: string; updatedAt: string }
  | { ok: false; error: string; fieldErrors?: FormErrors; conflict?: boolean };
