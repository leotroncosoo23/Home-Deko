import { describe, expect, it } from "vitest";
import { catalogHref, parseCatalogParams } from "./catalog-params";

describe("filtro de ofertas (?ofertas=1)", () => {
  it("se lee de la URL solo con el valor 1", () => {
    expect(parseCatalogParams({ ofertas: "1" }).ofertas).toBe(true);
    expect(parseCatalogParams({ ofertas: "si" }).ofertas).toBe(false);
    expect(parseCatalogParams({}).ofertas).toBe(false);
  });

  it("se escribe en el link y se omite cuando no está", () => {
    expect(catalogHref("/productos", { ofertas: true })).toBe("/productos?ofertas=1");
    expect(catalogHref("/productos", { ofertas: false, orden: "nuevos" })).toBe("/productos?orden=nuevos");
  });
});
