import { describe, expect, it } from "vitest";
import { formatARS, formatPrice, priceWithoutTaxes } from "./format";

describe("formatPrice (precios para clientes)", () => {
  it("sin ',00' cuando es redondo", () => {
    expect(formatPrice(25000)).toBe("$ 25.000");
    expect(formatPrice(0)).toBe("$ 0");
    expect(formatPrice(1234567)).toBe("$ 1.234.567");
  });

  it("con centavos reales, los muestra", () => {
    expect(formatPrice(25000.5)).toBe("$ 25.000,50");
    expect(formatPrice(99.99)).toBe("$ 99,99");
  });

  it("errores de coma flotante no inventan centavos", () => {
    expect(formatPrice(0.1 + 0.2 + 99.7)).toBe("$ 100");
  });

  it("espacio normal entre $ y el número", () => {
    expect(formatPrice(1000)).not.toMatch(/ /);
  });

  it("precio sin impuestos nacionales: precio / (1 + %/100), redondeado", () => {
    expect(priceWithoutTaxes(12100, 21)).toBe(10000);
    expect(priceWithoutTaxes(25000, 21)).toBe(20661);
    expect(priceWithoutTaxes(1000, 0)).toBe(1000);
    expect(priceWithoutTaxes(1105, 10.5)).toBe(1000);
  });

  it("formatARS (panel) sigue con centavos", () => {
    expect(formatARS(25000)).toBe("$ 25.000,00");
  });
});
