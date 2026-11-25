import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CUSTOMER, consoleText, intentResponse, stubGetnetEnv, TEST_ENV, tokenResponse } from "@/test/getnet-fixtures";
import { getnetConfig, GETNET_HOSTS, missingGetnetVars, onlinePaymentsAvailable, paymentProvider } from "./config";
import {
  buildIntentBody,
  createPaymentIntent,
  GetnetError,
  getAccessToken,
  normalizeStatus,
  parseWebhook,
  resetGetnetTokenCache,
  splitName,
  testGetnetConnection,
  toCents,
  verifyBasicAuth,
} from "./getnet";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

let fetchMock: ReturnType<typeof vi.fn>;
let logs: ReturnType<typeof vi.spyOn>[];

beforeEach(() => {
  resetGetnetTokenCache();
  stubGetnetEnv(vi.stubEnv);
  vi.stubEnv("PAYMENT_PROVIDER", "");
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  logs = [
    vi.spyOn(console, "info").mockImplementation(() => {}),
    vi.spyOn(console, "warn").mockImplementation(() => {}),
    vi.spyOn(console, "error").mockImplementation(() => {}),
    vi.spyOn(console, "log").mockImplementation(() => {}),
  ];
});

afterEach(() => {
  vi.useRealTimers();
});

const intentInput = {
  orderReference: "HD-1001",
  total: 12345.67,
  customer: CUSTOMER,
  billing: { street: "prueba-Calle Mitre", number: "123", postalCode: "9203" },
  successUrl: "https://www.homedekotrevelin.com/pedido/x?t=y",
  errorUrl: "https://www.homedekotrevelin.com/pedido/x?t=y",
  expiresIn: "2h",
};

describe("config", () => {
  it("usa Getnet por defecto y Mercado Pago solo si se pide", () => {
    expect(paymentProvider()).toBe("getnet");
    vi.stubEnv("PAYMENT_PROVIDER", "mercadopago");
    expect(paymentProvider()).toBe("mercadopago");
    vi.stubEnv("PAYMENT_PROVIDER", "cualquier-cosa");
    expect(paymentProvider()).toBe("getnet");
  });

  it("arma la config del ambiente con la URL de la doc", () => {
    expect(getnetConfig()?.apiBase).toBe(GETNET_HOSTS.sandbox);
    vi.stubEnv("GETNET_ENV", "production");
    expect(getnetConfig()?.apiBase).toBe("https://api.globalgetnet.com");
  });

  it("sin credenciales: no hay config ni pagos online, y dice qué falta (sin valores)", () => {
    vi.stubEnv("GETNET_CLIENT_SECRET", "");
    expect(getnetConfig()).toBeNull();
    expect(onlinePaymentsAvailable()).toBe(false);
    expect(missingGetnetVars()).toEqual(["GETNET_CLIENT_SECRET"]);
  });

  it("rechaza un GETNET_ENV desconocido", () => {
    vi.stubEnv("GETNET_ENV", "staging");
    expect(getnetConfig()).toBeNull();
  });
});

describe("token OAuth", () => {
  it("pide el token con client_credentials (form-urlencoded) y lo cachea", async () => {
    fetchMock.mockResolvedValueOnce(json(tokenResponse("prueba-token-1")));

    await expect(getAccessToken()).resolves.toBe("prueba-token-1");
    await expect(getAccessToken()).resolves.toBe("prueba-token-1");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.pre.globalgetnet.com/authentication/oauth2/access_token");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/x-www-form-urlencoded");
    const body = new URLSearchParams(String(init.body));
    expect(body.get("grant_type")).toBe("client_credentials");
    expect(body.get("client_id")).toBe(TEST_ENV.GETNET_CLIENT_ID);
    expect(body.get("client_secret")).toBe(TEST_ENV.GETNET_CLIENT_SECRET);
  });

  it("dos pedidos a la vez comparten un solo token", async () => {
    fetchMock.mockResolvedValueOnce(json(tokenResponse("prueba-token-1")));
    const [a, b] = await Promise.all([getAccessToken(), getAccessToken()]);
    expect(a).toBe("prueba-token-1");
    expect(b).toBe("prueba-token-1");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("lo renueva cuando está por vencer", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-25T12:00:00Z"));
    fetchMock
      .mockResolvedValueOnce(json(tokenResponse("prueba-token-1", 3599)))
      .mockResolvedValueOnce(json(tokenResponse("prueba-token-2", 3599)));

    await expect(getAccessToken()).resolves.toBe("prueba-token-1");
    vi.setSystemTime(new Date("2026-11-25T12:50:00Z")); // todavía vigente
    await expect(getAccessToken()).resolves.toBe("prueba-token-1");
    vi.setSystemTime(new Date("2026-11-25T12:59:30Z")); // a menos de 1 min de vencer
    await expect(getAccessToken()).resolves.toBe("prueba-token-2");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("un rechazo no deja el secret ni el token en los logs", async () => {
    fetchMock.mockResolvedValueOnce(json({ error: "invalid_client", error_description: "Bad client credentials" }, 401));
    await expect(getAccessToken()).rejects.toBeInstanceOf(GetnetError);
    const text = consoleText(logs);
    expect(text).toContain("status 401");
    expect(text).toContain("invalid_client");
    expect(text).not.toContain(TEST_ENV.GETNET_CLIENT_SECRET);
    expect(text).not.toContain(TEST_ENV.GETNET_CLIENT_ID);
  });

  it("Probar conexión: OK con token, error claro sin credenciales", async () => {
    fetchMock.mockResolvedValueOnce(json(tokenResponse()));
    await expect(testGetnetConnection()).resolves.toEqual({ ok: true });

    vi.stubEnv("GETNET_CLIENT_ID", "");
    await expect(testGetnetConnection()).resolves.toEqual({ ok: false, error: "Faltan credenciales de Getnet." });
  });

  it("sin credenciales no llama a Getnet", async () => {
    vi.stubEnv("GETNET_CLIENT_ID", "");
    await expect(getAccessToken()).rejects.toBeInstanceOf(GetnetError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("payment intent", () => {
  it("monto en centavos (entero)", () => {
    expect(toCents(12345.67)).toBe(1234567);
    expect(toCents(0.1 + 0.2)).toBe(30);
    expect(toCents(20000)).toBe(2000000);
  });

  it("arma el cuerpo con los campos obligatorios de la doc", () => {
    const body = buildIntentBody(intentInput);
    expect(body).toMatchObject({
      order_id: "HD-1001",
      payment: { amount: 1234567, currency: "ARS" },
      customer: {
        customer_id: CUSTOMER.dni,
        first_name: "Prueba",
        last_name: "Cliente Apellido",
        name: CUSTOMER.name,
        email: CUSTOMER.email,
        document_type: "DNI",
        document_number: CUSTOMER.dni,
        billing_address: { street: "prueba-Calle Mitre", number: "123", country: "AR", postal_code: "9203" },
      },
      configurations: { success_url: intentInput.successUrl, error_url: intentInput.errorUrl },
      expires_at: "2h",
    });
  });

  it("sin URLs de regreso (local) no manda configurations", () => {
    const body = buildIntentBody({ ...intentInput, successUrl: undefined, errorUrl: undefined });
    expect(body).not.toHaveProperty("configurations");
  });

  it("crea el intent con Bearer y devuelve id y página segura", async () => {
    fetchMock.mockResolvedValueOnce(json(tokenResponse("prueba-token-1"))).mockResolvedValueOnce(json(intentResponse));

    const intent = await createPaymentIntent(intentInput);
    expect(intent).toEqual({ paymentIntentId: "prueba-intent-0001", redirectUrl: intentResponse.redirect_url });

    const [url, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(url).toBe("https://api.pre.globalgetnet.com/payment-intent");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer prueba-token-1");
    expect(JSON.parse(String(init.body)).payment).toEqual({ amount: 1234567, currency: "ARS" });
  });

  it("en desarrollo loguea el monto, sin datos personales", async () => {
    vi.stubEnv("NODE_ENV", "development");
    fetchMock.mockResolvedValueOnce(json(tokenResponse())).mockResolvedValueOnce(json(intentResponse));
    await createPaymentIntent(intentInput);

    const text = consoleText(logs);
    expect(text).toContain("amount=1234567");
    expect(text).toContain("currency=ARS");
    for (const secret of [CUSTOMER.email, CUSTOMER.dni, CUSTOMER.name, "prueba-Calle Mitre", TEST_ENV.GETNET_CLIENT_SECRET, "prueba-token"]) {
      expect(text).not.toContain(secret);
    }
  });

  it("en producción no loguea el monto", async () => {
    vi.stubEnv("NODE_ENV", "production");
    fetchMock.mockResolvedValueOnce(json(tokenResponse())).mockResolvedValueOnce(json(intentResponse));
    await createPaymentIntent(intentInput);
    expect(consoleText(logs)).not.toContain("amount=");
  });

  it("si Getnet rechaza el intent: error, sin el cuerpo ni datos del cliente en el log", async () => {
    fetchMock
      .mockResolvedValueOnce(json(tokenResponse()))
      .mockResolvedValueOnce(json({ message: "invalid document", customer: { email: CUSTOMER.email } }, 400));

    await expect(createPaymentIntent(intentInput)).rejects.toMatchObject({ status: 400, transient: false });
    const text = consoleText(logs);
    expect(text).toContain("invalid document");
    expect(text).not.toContain(CUSTOMER.email);
    expect(text).not.toContain(CUSTOMER.dni);
  });

  it("Getnet caído (500) es un error pasajero", async () => {
    fetchMock.mockResolvedValueOnce(json(tokenResponse())).mockResolvedValueOnce(json({}, 503));
    await expect(createPaymentIntent(intentInput)).rejects.toMatchObject({ transient: true });
  });

  it("respuesta sin redirect_url → error", async () => {
    fetchMock.mockResolvedValueOnce(json(tokenResponse())).mockResolvedValueOnce(json({ payment_intent_id: "x" }));
    await expect(createPaymentIntent(intentInput)).rejects.toBeInstanceOf(GetnetError);
  });

  it("separa nombre y apellido", () => {
    expect(splitName("  Ana   María López ")).toEqual({ first: "Ana", last: "María López" });
    expect(splitName("Cher")).toEqual({ first: "Cher", last: "Cher" });
  });
});

describe("webhook: auth, formato y estados", () => {
  it("Basic auth correcta / incorrecta / ausente", () => {
    const ok = `Basic ${Buffer.from("u:p").toString("base64")}`;
    expect(verifyBasicAuth(ok, "u", "p")).toBe(true);
    expect(verifyBasicAuth(`Basic ${Buffer.from("u:x").toString("base64")}`, "u", "p")).toBe(false);
    expect(verifyBasicAuth(`Basic ${Buffer.from("u:pp").toString("base64")}`, "u", "p")).toBe(false);
    expect(verifyBasicAuth("Bearer abc", "u", "p")).toBe(false);
    expect(verifyBasicAuth(null, "u", "p")).toBe(false);
    expect(verifyBasicAuth(ok, "", "")).toBe(false);
  });

  it("estados documentados", () => {
    expect(normalizeStatus("Authorized")).toBe("approved");
    expect(normalizeStatus("Approved")).toBe("approved");
    expect(normalizeStatus("Denied")).toBe("rejected");
    expect(normalizeStatus("Pending")).toBeNull();
  });

  it("parsea el aviso y rechaza cuerpos inválidos", () => {
    expect(parseWebhook({ payment_intent_id: "x", payment: { amount: 100, currency: "ARS", result: { status: "Denied" } } })).not.toBeNull();
    expect(parseWebhook({ payment_intent_id: "x", payment: { amount: 1.5, currency: "ARS", result: { status: "Denied" } } })).toBeNull();
    expect(parseWebhook(null)).toBeNull();
    expect(parseWebhook({ foo: 1 })).toBeNull();
  });
});
