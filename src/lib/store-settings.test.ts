import { afterEach, describe, expect, it, vi } from "vitest";
import { pricingFrom, type StoreSettings } from "./store-settings";

const settings = {
  listSurchargePercent: 0,
  installmentsEnabled: false,
  installmentsMax: 6,
} as StoreSettings;

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("pricingFrom (PRICING_PREVIEW solo en desarrollo)", () => {
  it("sin override usa la configuración guardada", () => {
    vi.stubEnv("PRICING_PREVIEW", "");
    expect(pricingFrom(settings)).toEqual({ listSurchargePercent: 0, installmentsEnabled: false, installmentsMax: 6 });
  });

  it("en desarrollo, PRICING_PREVIEW pisa el recargo y las cuotas", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("PRICING_PREVIEW", "24,12");
    expect(pricingFrom(settings)).toEqual({ listSurchargePercent: 24, installmentsEnabled: true, installmentsMax: 12 });
  });

  it("en producción se ignora siempre", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PRICING_PREVIEW", "24,12");
    expect(pricingFrom(settings)).toEqual({ listSurchargePercent: 0, installmentsEnabled: false, installmentsMax: 6 });
  });
});
