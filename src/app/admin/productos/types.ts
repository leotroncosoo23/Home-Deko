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
};

/** Una imagen del producto (parte 5C). */
export type FormImage = {
  storagePath: string;
  url: string;
  isPrimary: boolean;
  colorValueKey: string | null;
  altText: string;
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
};

/** Una categoría para el selector. */
export type CategoryChoice = { id: string; name: string; isVisible: boolean };

/** Fila de la lista mínima de productos. */
export type ProductListItem = {
  id: string;
  name: string;
  status: ProductStatus;
  categoryName: string | null;
  imageUrl: string | null;
  basePrice: number;
  /** Precio mínimo y máximo entre las variantes activas. */
  minPrice: number;
  maxPrice: number;
  variantCount: number;
  hasVariants: boolean;
  totalStock: number;
  lowStock: boolean;
};

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

/** Lo que recibe cada tarjeta del formulario. */
export type FormCardProps = {
  values: ProductFormValues;
  /** Cambia algunos campos (los demás quedan igual). */
  update: (patch: Partial<ProductFormValues>) => void;
  errors: FormErrors;
  disabled: boolean;
};

export type SaveProductResult =
  | { ok: true; id: string; updatedAt: string }
  | { ok: false; error: string; fieldErrors?: FormErrors; conflict?: boolean };
