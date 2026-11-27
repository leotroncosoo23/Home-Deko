import { describe, expect, it } from "vitest";
import { buildIntentBody } from "@/lib/payments/getnet";
import {
  cartTotals,
  DEFAULT_PRICING,
  getPrices,
  listPrice,
  parsePricingPreview,
  type PricingSettings,
} from "./pricing";

const S24: PricingSettings = { listSurchargePercent: 24, installmentsEnabled: true, installmentsMax: 6 };
const S0: PricingSettings = DEFAULT_PRICING;

describe("listPrice (contado + recargo)", () => {
  it("38.000 con 24 % → 47.120", () => {
    expect(listPrice(38000, 24)).toBe(47120);
  });

  it("no redondea a centenas: deja los centavos", () => {
    // 12.345,67 × 1,24 = 15.308,6308 → 15.308,63
    expect(listPrice(12345.67, 24)).toBe(15308.63);
    // 999 × 1,155 = 1.153,845 → 1.153,85 (mitad hacia arriba)
    expect(listPrice(999, 15.5)).toBe(1153.85);
  });

  it("con 0 % la lista es el precio cargado tal cual", () => {
    expect(listPrice(12345.67, 0)).toBe(12345.67);
  });

  it("precio 0 queda en 0", () => {
    expect(listPrice(0, 24)).toBe(0);
  });
});

describe("getPrices", () => {
  it("sin recargo ni cuotas: lista = contado = precio cargado", () => {
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

  it("38.000 con 24 % y 6 cuotas, sin oferta", () => {
    const p = getPrices({ price: 38000, finalPrice: 38000 }, S24);
    expect(p.contado).toBe(38000);
    expect(p.contadoSinOferta).toBe(38000);
    expect(p.lista).toBe(47120);
    expect(p.oferta).toBe(false);
    expect(p.cuotas).toBe(6);
    expect(p.valorCuota).toBe(7853.33);
  });

  it("con oferta: el contado es el precio con oferta y la lista no cambia", () => {
    // 38.000 con 20 % de oferta → 30.400 en 1 pago; lista sobre 38.000
    const p = getPrices({ price: 38000, finalPrice: 30400 }, S24);
    expect(p.contado).toBe(30400);
    expect(p.contadoSinOferta).toBe(38000);
    expect(p.lista).toBe(47120);
    expect(p.oferta).toBe(true);
    expect(p.ofertaPercent).toBe(20);
    expect(p.valorCuota).toBe(7853.33);
  });

  it("cuotas apagadas: no hay cuotas", () => {
    const p = getPrices({ price: 9000, finalPrice: 9000 }, { ...S24, installmentsEnabled: false });
    expect(p.cuotas).toBeNull();
    expect(p.valorCuota).toBeNull();
    expect(p.lista).toBe(11160);
  });
});

describe("monto de punta a punta (carrito = create_order = lo que se manda a pagar)", () => {
  // MISMOS números que supabase/tests/precio_contado.sql:
  //   A: 38.000 sin oferta, 1 unidad
  //   B: 10.000 con oferta del 20 % (final 8.000), 2 unidades
  //   24 % de recargo para la lista, retiro en el local (envío 0)
  const lines = [
    { price: 38000, finalPrice: 38000, qty: 1 },
    { price: 10000, finalPrice: 8000, qty: 2 },
  ];

  it("total del carrito en 1 pago y en cuotas", () => {
    const t = cartTotals(lines, S24);
    // 38.000 + 8.000 × 2 = 54.000
    expect(t.contado).toBe(54000);
    // 47.120 + 12.400 × 2 = 71.920
    expect(t.lista).toBe(71920);
    expect(t.cuotas).toBe(6);
    expect(t.valorCuota).toBe(11986.67);
  });

  it("es la suma de getPrices().contado × cantidad", () => {
    const sum = lines.reduce((s, l) => s + getPrices(l, S24).contado * l.qty, 0);
    expect(cartTotals(lines, S24).contado).toBe(sum);
  });

  it("el recargo no cambia lo que se cobra", () => {
    expect(cartTotals(lines, S0).contado).toBe(cartTotals(lines, S24).contado);
  });

  it("lo que se manda a pagar a Getnet es ese mismo total (en centavos)", () => {
    const total = cartTotals(lines, S24).contado;
    const body = buildIntentBody({
      orderReference: "HD-1001",
      total,
      customer: { name: "Prueba Prueba", email: "prueba@example.com", dni: "30000000" },
      billing: { street: "Calle", number: "1", postalCode: "9203" },
    });
    expect(body.payment.amount).toBe(5400000);
  });

  it("el envío se suma igual al 1 pago y a las cuotas (sin recargo)", () => {
    const t = cartTotals(lines, S24, 20000);
    expect(t.contado).toBe(74000);
    // 71.920 + 20.000 = 91.920 → 6 cuotas de 15.320
    expect(t.lista).toBe(91920);
    expect(t.valorCuota).toBe(15320);
  });

  it("con centavos el total no se redondea", () => {
    expect(cartTotals([{ price: 12345.67, finalPrice: 11111.1, qty: 1 }], S24).contado).toBe(11111.1);
  });
});

describe("parsePricingPreview", () => {
  it("lee recargo y cuotas", () => {
    expect(parsePricingPreview("24,6")).toEqual({ listSurchargePercent: 24, installmentsEnabled: true, installmentsMax: 6 });
    expect(parsePricingPreview("10")).toEqual({ listSurchargePercent: 10, installmentsEnabled: false, installmentsMax: 6 });
    expect(parsePricingPreview("150,12")).toEqual({ listSurchargePercent: 150, installmentsEnabled: true, installmentsMax: 12 });
  });
  it("vacío o inválido → null", () => {
    expect(parsePricingPreview(undefined)).toBeNull();
    expect(parsePricingPreview("abc")).toBeNull();
    expect(parsePricingPreview("24,5")).toBeNull();
    expect(parsePricingPreview("1000")).toBeNull();
  });
});
