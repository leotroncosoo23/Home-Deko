/**
 * Slugs: la versión "para URL" de un nombre.
 *   "Baño y Cocina" → "bano-y-cocina"
 *
 * El formato es el mismo que exige la base (check en categories/products):
 * minúsculas, números y guiones simples, sin guiones al principio ni al final.
 */
export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const SLUG_MAX_LENGTH = 80;

export function slugify(text: string): string {
  return (
    text
      // "NFD" separa cada letra de su tilde ("á" → "a" + "´")…
      .normalize("NFD")
      // …y acá se borran las tildes sueltas (también la de la ñ → n).
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      // Todo lo que no sea letra o número pasa a ser un guion.
      .replace(/[^a-z0-9]+/g, "-")
      .slice(0, SLUG_MAX_LENGTH)
      // Sin guiones al principio ni al final.
      .replace(/^-+|-+$/g, "")
  );
}
