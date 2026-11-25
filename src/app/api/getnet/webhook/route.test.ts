import { beforeEach, describe, expect, it, vi } from "vitest";
import { basicAuth, consoleText, CUSTOMER, stubGetnetEnv, webhookPayload } from "@/test/getnet-fixtures";

/**
 * Webhook de Getnet, sin red ni base: Supabase, los mails y la caché se
 * simulan. Lo que decide la BASE (stock atómico, idempotencia, monto exacto,
 * rechazado → aprobado) se prueba aparte con SQL (begin … rollback); acá se
 * prueba que el webhook llame bien y reaccione bien a cada resultado.
 */

const after = vi.fn((fn: () => unknown) => void fn());
const revalidateTag = vi.fn();
const sendOrderEmails = vi.fn();
const rpc = vi.fn();
const maybeSingle = vi.fn();

vi.mock("next/server", () => ({ after: (fn: () => unknown) => after(fn) }));
vi.mock("next/cache", () => ({ revalidateTag: (...args: unknown[]) => revalidateTag(...args) }));
vi.mock("@/lib/email/order-emails", () => ({ sendOrderEmails: (...args: unknown[]) => sendOrderEmails(...args) }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }),
    rpc,
  }),
}));

const { POST } = await import("./route");

const ORDER = { id: "00000000-0000-4000-8000-000000001001", order_number: 1001 };

function request(body: unknown, auth: string | null = basicAuth()) {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (auth) headers.set("Authorization", auth);
  const req = new Request("https://www.homedekotrevelin.com/api/getnet/webhook", {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
  return POST(req as never);
}

const rpcResult = (result: string, stockChanged = false) => ({ data: [{ result, stock_changed: stockChanged }], error: null });

let logs: ReturnType<typeof vi.spyOn>[];

beforeEach(() => {
  stubGetnetEnv(vi.stubEnv);
  after.mockClear();
  revalidateTag.mockReset();
  sendOrderEmails.mockReset();
  rpc.mockReset();
  maybeSingle.mockReset().mockResolvedValue({ data: ORDER, error: null });
  logs = [
    vi.spyOn(console, "info").mockImplementation(() => {}),
    vi.spyOn(console, "warn").mockImplementation(() => {}),
    vi.spyOn(console, "error").mockImplementation(() => {}),
  ];
});

describe("autenticación", () => {
  it("sin Authorization → 401 y no toca la base", async () => {
    const res = await request(webhookPayload(), null);
    expect(res.status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("contraseña incorrecta → 401", async () => {
    const res = await request(webhookPayload(), basicAuth("prueba-webhook", "otra"));
    expect(res.status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("sin credenciales configuradas → 503 (Getnet reintenta)", async () => {
    vi.stubEnv("GETNET_WEBHOOK_PASSWORD", "");
    const res = await request(webhookPayload());
    expect(res.status).toBe(503);
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("pagos", () => {
  it("aprobado: llama a apply_order_payment con monto en pesos y manda los mails", async () => {
    rpc.mockResolvedValueOnce(rpcResult("approved", true));
    const res = await request(webhookPayload({ status: "Authorized", amount: 1234567 }));

    expect(res.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("apply_order_payment", {
      p_order_id: ORDER.id,
      p_payment_id: "prueba-pago-1",
      p_status: "approved",
      p_status_detail: "Authorized — Transacción aprobada",
      p_amount: 12345.67,
      p_currency: "ARS",
      p_provider: "getnet",
      p_mismatch: false,
    });
    expect(revalidateTag).toHaveBeenCalledTimes(1);
    expect(sendOrderEmails).toHaveBeenCalledWith(ORDER.id, "approved");
  });

  it("rechazado: estado 'rejected', sin mails ni cambios de stock", async () => {
    rpc.mockResolvedValueOnce(rpcResult("updated"));
    const res = await request(webhookPayload({ status: "Denied", returnMessage: "Rechazada por el emisor" }));

    expect(res.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith(
      "apply_order_payment",
      expect.objectContaining({ p_status: "rejected", p_status_detail: "Denied — Rechazada por el emisor" }),
    );
    expect(sendOrderEmails).not.toHaveBeenCalled();
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("duplicado: la base devuelve already_processed → ni mails ni caché", async () => {
    rpc.mockResolvedValueOnce(rpcResult("approved", true)).mockResolvedValueOnce(rpcResult("already_processed"));
    await request(webhookPayload());
    const res = await request(webhookPayload());

    expect(res.status).toBe(200);
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(sendOrderEmails).toHaveBeenCalledTimes(1);
    expect(revalidateTag).toHaveBeenCalledTimes(1);
  });

  it("monto distinto: lo controla la base (review) → solo el mail de revisión", async () => {
    rpc.mockResolvedValueOnce(rpcResult("review"));
    const res = await request(webhookPayload({ amount: 100 }));

    expect(res.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("apply_order_payment", expect.objectContaining({ p_amount: 1, p_status: "approved" }));
    expect(sendOrderEmails).toHaveBeenCalledWith(ORDER.id, "review");
    expect(sendOrderEmails).not.toHaveBeenCalledWith(ORDER.id, "approved");
  });

  it("referencia distinta: p_mismatch = true (no se aprueba)", async () => {
    rpc.mockResolvedValueOnce(rpcResult("review"));
    await request(webhookPayload({ orderId: "HD-9999" }));
    expect(rpc).toHaveBeenCalledWith("apply_order_payment", expect.objectContaining({ p_mismatch: true }));
  });

  it("sin referencia en el aviso: también p_mismatch = true", async () => {
    rpc.mockResolvedValueOnce(rpcResult("review"));
    await request(webhookPayload({ orderId: null }));
    expect(rpc).toHaveBeenCalledWith("apply_order_payment", expect.objectContaining({ p_mismatch: true }));
  });

  it("rechazado → aprobado (otra tarjeta, mismo intent): se aprueba y manda los mails", async () => {
    rpc.mockResolvedValueOnce(rpcResult("updated")).mockResolvedValueOnce(rpcResult("approved", true));
    await request(webhookPayload({ status: "Denied", paymentId: "prueba-pago-1" }));
    const res = await request(webhookPayload({ status: "Authorized", paymentId: "prueba-pago-2" }));

    expect(res.status).toBe(200);
    expect(rpc).toHaveBeenNthCalledWith(1, "apply_order_payment", expect.objectContaining({ p_status: "rejected" }));
    expect(rpc).toHaveBeenNthCalledWith(
      2,
      "apply_order_payment",
      expect.objectContaining({ p_status: "approved", p_payment_id: "prueba-pago-2" }),
    );
    expect(sendOrderEmails).toHaveBeenCalledTimes(1);
    expect(sendOrderEmails).toHaveBeenCalledWith(ORDER.id, "approved");
  });

  it("aprobado → rechazado tardío: sigue aprobado (already_processed), sin mails nuevos", async () => {
    rpc.mockResolvedValueOnce(rpcResult("approved", true)).mockResolvedValueOnce(rpcResult("already_processed"));
    await request(webhookPayload({ status: "Authorized", paymentId: "prueba-pago-2" }));
    const res = await request(webhookPayload({ status: "Denied", paymentId: "prueba-pago-1" }));

    expect(res.status).toBe(200);
    expect(sendOrderEmails).toHaveBeenCalledTimes(1);
  });

  it("intent desconocido: 200 sin tocar pedidos", async () => {
    maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    const res = await request(webhookPayload({ intentId: "prueba-intent-otro" }));
    expect(res.status).toBe(200);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("estado no documentado: 200 sin tocar pedidos", async () => {
    const res = await request(webhookPayload({ status: "Pending" }));
    expect(res.status).toBe(200);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("cuerpo inválido: 200 sin tocar pedidos (reintentar no lo arregla)", async () => {
    expect((await request("no es json")).status).toBe(200);
    expect((await request({ foo: "bar" })).status).toBe(200);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("error de la base: 500 para que Getnet reintente", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: "57014", message: "timeout" } });
    const res = await request(webhookPayload());
    expect(res.status).toBe(500);
    expect(sendOrderEmails).not.toHaveBeenCalled();
  });

  it("los logs no tienen datos personales ni credenciales", async () => {
    rpc.mockResolvedValue(rpcResult("approved", true));
    await request(webhookPayload());
    await request(webhookPayload({ orderId: "HD-9999" }));
    await request(webhookPayload(), basicAuth("prueba-webhook", "mal"));
    await request({ foo: CUSTOMER.email });

    const text = consoleText(logs);
    expect(text.length).toBeGreaterThan(0);
    for (const s of [CUSTOMER.email, CUSTOMER.dni, CUSTOMER.name, "prueba-clave-webhook", "Basic "]) {
      expect(text).not.toContain(s);
    }
  });
});
