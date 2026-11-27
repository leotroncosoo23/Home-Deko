/**
 * CATEGORÍAS Y SUBCATEGORÍAS (un solo nivel).
 *
 *   - parent_id null = categoría principal (Cocina).
 *   - parent_id = id de una principal = subcategoría (Cocina › Utensilios).
 *   - Una subcategoría NO puede tener subcategorías (lo frena también la
 *     base: trigger categories_check_level, migración 20261210000001).
 *   - La principal muestra sus productos y los de sus subcategorías.
 *
 * Funciones puras: las usan la tienda y el panel (y src/lib/categories.test.ts).
 */

export type CategoryLike = {
  id: string;
  name: string;
  parentId: string | null;
};

export type CategoryTreeNode<T extends CategoryLike> = T & { children: T[] };

/**
 * Principales con sus subcategorías debajo, respetando el orden en que
 * llegan (sort_order). Una subcategoría cuya principal no está en la lista
 * (oculta) queda afuera.
 */
export function buildCategoryTree<T extends CategoryLike>(flat: T[]): CategoryTreeNode<T>[] {
  const mains = flat.filter((c) => c.parentId === null);
  return mains.map((m) => ({ ...m, children: flat.filter((c) => c.parentId === m.id) }));
}

/** Los ids que abarca una categoría: la principal + sus subcategorías; la subcategoría, solo ella. */
export function categoryIdsFor<T extends CategoryLike>(category: T, flat: T[]): string[] {
  if (category.parentId !== null) return [category.id];
  return [category.id, ...flat.filter((c) => c.parentId === category.id).map((c) => c.id)];
}

/** "Cocina › Utensilios" (o "Cocina" si es principal). */
export function categoryLabel<T extends CategoryLike>(category: T, flat: T[]): string {
  if (category.parentId === null) return category.name;
  const parent = flat.find((c) => c.id === category.parentId);
  return parent ? `${parent.name} › ${category.name}` : category.name;
}

/** La principal de una categoría (ella misma si ya es principal). */
export function mainCategoryOf<T extends CategoryLike>(category: T, flat: T[]): T | null {
  if (category.parentId === null) return category;
  return flat.find((c) => c.id === category.parentId) ?? null;
}

/**
 * ¿Puede `categoryId` tener a `parentId` como principal? Misma regla que el
 * trigger de la base. Devuelve el motivo si no se puede (null = se puede).
 */
export function parentError<T extends CategoryLike>(
  categoryId: string | null,
  parentId: string | null,
  flat: T[],
): string | null {
  if (parentId === null) return null;
  if (categoryId !== null && parentId === categoryId) return "Una categoría no puede pertenecer a sí misma.";
  const parent = flat.find((c) => c.id === parentId);
  if (!parent) return "La categoría elegida ya no existe.";
  if (parent.parentId !== null) return "Elegí una categoría principal: las subcategorías no pueden tener subcategorías.";
  if (categoryId !== null && flat.some((c) => c.parentId === categoryId)) {
    return "Tiene subcategorías: no puede pasar a ser una subcategoría. Movelas primero.";
  }
  return null;
}

/** /categorias/cocina o /categorias/cocina/utensilios. */
export function categoryPath(mainSlug: string, subSlug?: string | null): string {
  return subSlug ? `/categorias/${mainSlug}/${subSlug}` : `/categorias/${mainSlug}`;
}

/** El link de una categoría cualquiera (anidado si es subcategoría). */
export function hrefForCategory<T extends CategoryLike & { slug: string }>(category: T, flat: T[]): string {
  const main = mainCategoryOf(category, flat);
  if (!main || main.id === category.id) return categoryPath(category.slug);
  return categoryPath(main.slug, category.slug);
}

/**
 * Lo que ve la TIENDA: subcategorías con al menos un producto publicado,
 * y principales con algún producto (propio o de sus subcategorías).
 * `count` = productos publicados de cada categoría (sin contar hijas).
 */
export function storeTree<T extends CategoryLike & { productCount: number }>(
  flat: T[],
): CategoryTreeNode<T & { totalCount: number }>[] {
  return buildCategoryTree(flat)
    .map((m) => {
      const children = m.children.filter((c) => c.productCount > 0).map((c) => ({ ...c, totalCount: c.productCount }));
      const totalCount = m.productCount + children.reduce((s, c) => s + c.productCount, 0);
      return { ...m, totalCount, children };
    })
    .filter((m) => m.totalCount > 0);
}

/** Orden nuevo de una lista tras mover un elemento de `from` a `to`. */
export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const next = list.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/** Slug libre: "utensilios", y si ya existe, "utensilios-2", "utensilios-3"… */
export function uniqueSlug(base: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  if (!used.has(base)) return base;
  for (let i = 2; i < 1000; i++) {
    const candidate = `${base}-${i}`;
    if (!used.has(candidate)) return candidate;
  }
  return `${base}-${Date.now()}`;
}
