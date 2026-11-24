/**
 * Tipos compartidos entre el servidor (data.ts, actions.ts) y los
 * componentes del navegador. Este archivo no importa nada del servidor,
 * así que se puede usar desde "use client" sin problema.
 */

/** Una categoría tal como la muestra el panel. */
export type Category = {
  id: string;
  name: string;
  slug: string;
  isVisible: boolean;
  imagePath: string | null;
  /** URL pública de la imagen (o null si no tiene). */
  imageUrl: string | null;
  sortOrder: number;
  /** Productos de CUALQUIER estado (borrador, publicado, archivado). */
  productCount: number;
};

/** Campos del formulario que pueden tener un error para mostrar. */
export type CategoryField = "name" | "slug" | "image";

/** Lo que devuelve cada Server Action: o salió bien, o un mensaje claro. */
export type ActionResult =
  | { ok: true }
  | {
      ok: false;
      error: string;
      fieldErrors?: Partial<Record<CategoryField, string>>;
      /** Al eliminar: la categoría tiene productos (hay que ocultarla). */
      productCount?: number;
    };
