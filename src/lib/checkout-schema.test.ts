import { describe, expect, it } from "vitest";
import { billingFrom, checkoutSchemaFor, splitStreetNumber } from "./checkout-schema";

const base = {
  name: "Prueba Cliente",
  email: "prueba-cliente@example.com",
  phone: "2945 123456",
  acceptTerms: true as const,
  items: [{ variantId: "00000000-0000-4000-8000-000000000001", qty: 1 }],
};

const pickup = { ...base, delivery: "pickup" as const };
const shipping = {
  ...base,
  delivery: "shipping" as const,
  address: "Mitre 123",
  city: "Trevelin",
  province: "Chubut",
  postalCode: "9203",
};

describe("DNI y facturación (Getnet)", () => {
  const getnet = checkoutSchemaFor(true);
  const mp = checkoutSchemaFor(false);

  it("Mercado Pago no pide DNI ni facturación", () => {
    expect(mp.safeParse(pickup).success).toBe(true);
  });

  it("Getnet exige DNI de 7 u 8 números", () => {
    const bill = { billingStreet: "Mitre", billingNumber: "123", billingPostalCode: "9203" };
    expect(getnet.safeParse({ ...pickup, ...bill }).success).toBe(false);
    expect(getnet.safeParse({ ...pickup, ...bill, dni: "123456" }).success).toBe(false);
    expect(getnet.safeParse({ ...pickup, ...bill, dni: "123456789" }).success).toBe(false);
    expect(getnet.safeParse({ ...pickup, ...bill, dni: "30a12345" }).success).toBe(false);
    expect(getnet.safeParse({ ...pickup, ...bill, dni: "1234567" }).success).toBe(true);
    expect(getnet.safeParse({ ...pickup, ...bill, dni: "30.123.456" }).success).toBe(true);
  });

  it("con retiro pide calle, número y CP de facturación", () => {
    const r = getnet.safeParse({ ...pickup, dni: "30123456" });
    expect(r.success).toBe(false);
    const paths = r.error!.issues.map((i) => i.path[0]);
    expect(paths).toEqual(expect.arrayContaining(["billingStreet", "billingNumber", "billingPostalCode"]));
  });

  it("con envío usa la dirección de envío (tiene que tener número o S/N)", () => {
    expect(getnet.safeParse({ ...shipping, dni: "30123456" }).success).toBe(true);
    expect(getnet.safeParse({ ...shipping, dni: "30123456", address: "Calle sin numero" }).success).toBe(false);
    expect(getnet.safeParse({ ...shipping, dni: "30123456", address: "Ruta 259 S/N" }).success).toBe(true);
  });

  it("billingFrom arma los datos para el pedido", () => {
    const s = getnet.parse({ ...shipping, dni: "30.123.456", address: "Av. San Martín 1234 B" });
    expect(billingFrom(s)).toEqual({ dni: "30123456", street: "Av. San Martín", number: "1234B", postalCode: "9203" });

    const p = getnet.parse({ ...pickup, dni: "30123456", billingStreet: " Mitre ", billingNumber: "s/n", billingPostalCode: "u9203abc" });
    expect(billingFrom(p)).toEqual({ dni: "30123456", street: "Mitre", number: "S/N", postalCode: "U9203ABC" });
  });

  it("splitStreetNumber", () => {
    expect(splitStreetNumber("Mitre 123")).toEqual({ street: "Mitre", number: "123" });
    expect(splitStreetNumber("Calle 25 de Mayo 450")).toEqual({ street: "Calle 25 de Mayo", number: "450" });
    expect(splitStreetNumber("Belgrano N° 77")).toEqual({ street: "Belgrano", number: "77" });
    expect(splitStreetNumber("Ruta 40 s/n")).toEqual({ street: "Ruta 40", number: "S/N" });
    expect(splitStreetNumber("Mitre")).toBeNull();
    expect(splitStreetNumber("123")).toBeNull();
  });
});
