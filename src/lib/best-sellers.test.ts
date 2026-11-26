import { describe, expect, it } from "vitest";
import { pickBestSellersOrFeatured, rankBestSellers } from "./best-sellers";

describe("rankBestSellers", () => {
  it("suma las unidades por producto y ordena de mayor a menor", () => {
    expect(
      rankBestSellers([
        { product_id: "a", quantity: 1 },
        { product_id: "b", quantity: 2 },
        { product_id: "a", quantity: 3 },
        { product_id: "c", quantity: 1 },
      ]),
    ).toEqual(["a", "b", "c"]);
  });

  it("ignora productos borrados y cantidades inválidas", () => {
    expect(
      rankBestSellers([
        { product_id: null, quantity: 9 },
        { product_id: "a", quantity: 0 },
        { product_id: "b", quantity: null },
        { product_id: "c", quantity: 1 },
      ]),
    ).toEqual(["c"]);
  });

  it("en un empate respeta el orden en que aparecieron", () => {
    expect(
      rankBestSellers([
        { product_id: "x", quantity: 2 },
        { product_id: "y", quantity: 2 },
      ]),
    ).toEqual(["x", "y"]);
  });
});

describe("pickBestSellersOrFeatured", () => {
  it("con 4 o más vendidos muestra «Más vendidos» (hasta el límite)", () => {
    const r = pickBestSellersOrFeatured([1, 2, 3, 4, 5], [9], 4);
    expect(r).toEqual({ kind: "best", products: [1, 2, 3, 4] });
  });

  it("con menos de 4 vendidos muestra solo los destacados", () => {
    const r = pickBestSellersOrFeatured([1, 2, 3], [7, 8], 8);
    expect(r).toEqual({ kind: "featured", products: [7, 8] });
  });
});
