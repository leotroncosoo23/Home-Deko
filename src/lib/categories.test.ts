import { describe, expect, it } from "vitest";
import {
  buildCategoryTree,
  categoryIdsFor,
  categoryLabel,
  categoryPath,
  hrefForCategory,
  moveItem,
  parentError,
  storeTree,
  uniqueSlug,
} from "./categories";

const cat = (id: string, name: string, parentId: string | null = null, productCount = 0) => ({
  id,
  name,
  slug: name.toLowerCase().replace(/\s+/g, "-"),
  parentId,
  productCount,
});

const FLAT = [
  cat("c", "Cocina", null, 2),
  cat("b", "Baño", null, 1),
  cat("u", "Utensilios", "c", 3),
  cat("v", "Vajilla", "c", 0),
  cat("t", "Toallas", "b", 4),
];

describe("árbol de categorías", () => {
  it("cada principal con sus subcategorías, en el orden recibido", () => {
    const tree = buildCategoryTree(FLAT);
    expect(tree.map((m) => m.id)).toEqual(["c", "b"]);
    expect(tree[0].children.map((c) => c.id)).toEqual(["u", "v"]);
    expect(tree[1].children.map((c) => c.id)).toEqual(["t"]);
  });

  it("una subcategoría sin su principal (oculta) queda afuera", () => {
    const tree = buildCategoryTree(FLAT.filter((c) => c.id !== "b"));
    expect(tree.flatMap((m) => m.children.map((c) => c.id))).not.toContain("t");
  });
});

describe("la principal incluye los productos de sus subcategorías", () => {
  it("ids de la principal = ella + sus subcategorías", () => {
    expect(categoryIdsFor(FLAT[0], FLAT)).toEqual(["c", "u", "v"]);
  });
  it("una subcategoría abarca solo a ella", () => {
    expect(categoryIdsFor(FLAT[2], FLAT)).toEqual(["u"]);
  });
  it("la tienda suma los productos de las subcategorías y esconde las vacías", () => {
    const tree = storeTree(FLAT);
    expect(tree[0].totalCount).toBe(5);
    expect(tree[0].children.map((c) => c.id)).toEqual(["u"]);
  });
  it("una principal sin productos propios ni en subcategorías no aparece", () => {
    expect(storeTree([cat("x", "Vacía"), cat("y", "Hija", "x")])).toEqual([]);
  });
});

describe("subcategoría sin hijas (misma regla que la base)", () => {
  it("se puede poner una categoría dentro de una principal", () => {
    expect(parentError("n", "c", FLAT)).toBeNull();
    expect(parentError(null, "c", FLAT)).toBeNull();
  });
  it("no se puede poner dentro de una subcategoría", () => {
    expect(parentError(null, "u", FLAT)).toMatch(/principal/);
  });
  it("una principal con subcategorías no puede pasar a ser subcategoría", () => {
    expect(parentError("c", "b", FLAT)).toMatch(/subcategorías/);
  });
  it("no puede pertenecer a sí misma", () => {
    expect(parentError("b", "b", FLAT)).not.toBeNull();
  });
  it("sin principal (null) siempre se puede", () => {
    expect(parentError("u", null, FLAT)).toBeNull();
  });
});

describe("textos y links", () => {
  it("rótulo con la principal", () => {
    expect(categoryLabel(FLAT[2], FLAT)).toBe("Cocina › Utensilios");
    expect(categoryLabel(FLAT[0], FLAT)).toBe("Cocina");
  });
  it("links anidados", () => {
    expect(categoryPath("cocina")).toBe("/categorias/cocina");
    expect(hrefForCategory(FLAT[2], FLAT)).toBe("/categorias/cocina/utensilios");
    expect(hrefForCategory(FLAT[1], FLAT)).toBe("/categorias/baño");
  });
  it("slug libre", () => {
    expect(uniqueSlug("termos", ["vajilla"])).toBe("termos");
    expect(uniqueSlug("termos", ["termos", "termos-2"])).toBe("termos-3");
  });
  it("mover en una lista", () => {
    expect(moveItem(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
    expect(moveItem(["a", "b"], 0, 5)).toEqual(["a", "b"]);
  });
});
