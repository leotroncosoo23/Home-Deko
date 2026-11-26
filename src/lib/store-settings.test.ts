import { afterEach, describe, expect, it, vi } from "vitest";
import { pricingFrom, type StoreSettings } from "./store-settings";

const settings = {
  cashDiscountPercent: 0,
  installmentsEnabled: false,
  installmentsMax: 6,
} as StoreSettings;

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("pricingFrom (PRICING_PREVIEW solo en desarrollo)", () => {
  it("sin override usa la configuración guardada", () => {
    vi.stubEnv("PRICING_PREVIEW", "");
    expect(pricingFrom(settings)).toEqual({ cashDiscountPercent: 0, installmentsEnabled: false, installmentsMax: 6 });
  });

  it("en desarrollo, PRICING_PREVIEW pisa el % y las cuotas", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("PRICING_PREVIEW", "15,12");
    expect(pricingFrom(settings)).toEqual({ cashDiscountPercent: 15, installmentsEnabled: true, installmentsMax: 12 });
  });

  it("en producción se ignora siempre", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PRICING_PREVIEW", "15,12");
    expect(pricingFrom(settings)).toEqual({ cashDiscountPercent: 0, installmentsEnabled: false, installmentsMax: 6 });
  });
});
