import { describe, expect, it } from "vitest";
import { buildIntentBody } from "@/lib/payments/getnet";
import {
  cartTotals,
  cashPrice,
  DEFAULT_PRICING,
  finalBoundForCash,
  getPrices,
  parsePricingPreview,
  type PricingSettings,
} from "./pricing";

const S15: PricingSettings = { cashDiscountPercent: 15, installmentsEnabled: true, installmentsMax: 6 };
const S0: PricingSettings = DEFAULT_PRICING;

describe("cashPrice (espejo de public.cash_price)", () => {
  it("con 0 % devuelve el precio tal cual, sin redondear (sin oferta)", () => {
    expect(cashPrice(12345.67, 12345.67, 0)).toBe(12345.67);
  });

  it("con 0 % devuelve el precio con oferta tal cual (con oferta)", () => {
    expect(cashPrice(12345.67, 9876.54, 0)).toBe(9876.54);
  });

  it("descuenta el % y redondea a pesos", () => {
    expect(cashPrice(10000, 10000, 15)).toBe(8500);
    expect(cashPrice(12345.67, 12345.67, 15)).toBe(10494); // 10493,8195
  });

  it("redondea las mitades hacia arriba (como Postgres)", () => {
    // 1001 × 0,85 = 850,85 → 851 ; 10 × 0,85 = 8,5 → 9
    expect(cashPrice(1001, 1001, 15)).toBe(851);
    expect(cashPrice(10, 10, 15)).toBe(9);
  });

  it("aplica la oferta en % sobre el contado", () => {
    // lista 10.000, oferta 20 % → final 8.000; contado 8.500 × 0,8 = 6.800
    expect(cashPrice(10000, 8000, 15)).toBe(6800);
  });

  it("oferta de monto fijo: misma proporción de rebaja sobre el contado", () => {
    // lista 50.000, oferta −5.000 (10 %) → contado 42.500 × 0,9 = 38.250
    expect(cashPrice(50000, 45000, 15)).toBe(38250);
  });

  it("precio 0 queda en 0", () => {
    expect(cashPrice(0, 0, 15)).toBe(0);
  });
});

describe("getPrices", () => {
  it("sin descuento ni cuotas: contado = lista, sin cuotas", () => {
    const p = getPrices({ price: 25000, finalPrice: 25000 }, S0);
    expect(p).toEqual({
      lista: 25000,
      contadoSinOferta: 25000,
      contado: 25000,
      oferta: false,
      ofertaPercent: null,
      cuotas: null,
      valorCuota: null,
    });
  });

  it("con 15 %, oferta del 20 % y 6 cuotas", () => {
    const p = getPrices({ price: 10000, finalPrice: 8000 }, S15);
    expect(p.lista).toBe(10000);
    expect(p.contadoSinOferta).toBe(8500);
    expect(p.contado).toBe(6800);
    expect(p.oferta).toBe(true);
    expect(p.ofertaPercent).toBe(20);
    expect(p.cuotas).toBe(6);
    expect(p.valorCuota).toBe(1666.67);
  });

  it("la lista no cambia con la oferta", () => {
    expect(getPrices({ price: 10000, finalPrice: 5000 }, S15).lista).toBe(10000);
  });

  it("con 0 % y oferta, el contado es el precio con oferta de siempre", () => {
    const p = getPrices({ price: 12345.67, finalPrice: 11111.1 }, S0);
    expect(p.contadoSinOferta).toBe(12345.67);
    expect(p.contado).toBe(11111.1);
    expect(p.ofertaPercent).toBe(10);
  });

  it("cuotas apagadas: no hay cuotas", () => {
    const p = getPrices({ price: 9000, finalPrice: 9000 }, { ...S15, installmentsEnabled: false });
    expect(p.cuotas).toBeNull();
    expect(p.valorCuota).toBeNull();
  });
});

describe("monto de punta a punta (carrito = create_order = lo que se manda a pagar)", () => {
  // MISMOS números que supabase/tests/precio_contado.sql:
  //   variante A: lista 10.000, oferta 20 % (final 8.000), 2 unidades
  //   variante B: lista 12.345,67 sin oferta, 1 unidad
  //   15 % en 1 pago, retiro en el local (envío 0)
  const lines = [
    { price: 10000, finalPrice: 8000, qty: 2 },
    { price: 12345.67, finalPrice: 12345.67, qty: 1 },
  ];

  it("total del carrito en 1 pago", () => {
    const t = cartTotals(lines, S15);
    // 6.800 × 2 + 10.494 = 24.094
    expect(t.contado).toBe(24094);
    expect(t.lista).toBe(32345.67);
    expect(t.cuotas).toBe(6);
  });

  it("es la suma de getPrices().contado × cantidad", () => {
    const sum = lines.reduce((s, l) => s + getPrices(l, S15).contado * l.qty, 0);
    expect(cartTotals(lines, S15).contado).toBe(sum);
  });

  it("lo que se manda a pagar a Getnet es ese mismo total (en centavos)", () => {
    const total = cartTotals(lines, S15).contado;
    const body = buildIntentBody({
      orderReference: "HD-1001",
      total,
      customer: { name: "Prueba Prueba", email: "prueba@example.com", dni: "30000000" },
      billing: { street: "Calle", number: "1", postalCode: "9203" },
    });
    expect(body.payment.amount).toBe(2409400);
  });

  it("con 0 % el total es exactamente el de antes (precio con oferta)", () => {
    // 8.000 × 2 + 12.345,67 = 28.345,67
    expect(cartTotals(lines, S0).contado).toBe(28345.67);
  });
});

describe("finalBoundForCash (filtro de precio del catálogo)", () => {
  it("con 0 % no cambia nada", () => {
    expect(finalBoundForCash(5000, 0, "min")).toBe(5000);
    expect(finalBoundForCash(null, 15, "max")).toBeNull();
  });
  it("un producto de contado 8.500 (lista 10.000) entra con min 8.500 y max 8.500", () => {
    expect(finalBoundForCash(8500, 15, "min")!).toBeLessThanOrEqual(10000);
    expect(finalBoundForCash(8500, 15, "max")!).toBeGreaterThanOrEqual(10000);
  });
  it("y queda afuera con min 8.501 o max 8.499", () => {
    expect(finalBoundForCash(8501, 15, "min")!).toBeGreaterThan(10000);
    expect(finalBoundForCash(8499, 15, "max")!).toBeLessThan(10000);
  });
});

describe("parsePricingPreview", () => {
  it("lee % y cuotas", () => {
    expect(parsePricingPreview("15,6")).toEqual({ cashDiscountPercent: 15, installmentsEnabled: true, installmentsMax: 6 });
    expect(parsePricingPreview("10")).toEqual({ cashDiscountPercent: 10, installmentsEnabled: false, installmentsMax: 6 });
  });
  it("vacío o inválido → null", () => {
    expect(parsePricingPreview(undefined)).toBeNull();
    expect(parsePricingPreview("abc")).toBeNull();
    expect(parsePricingPreview("15,5")).toBeNull();
  });
});
