import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { requireEnv } from "@/lib/env";

/**
 * MERCADO PAGO (Checkout Pro), con su API REST directa (sin SDK).
 *
 *   - createPreference(): arma el "link de pago" de un pedido.
 *   - getPayment(): consulta un pago. Es la ÚNICA fuente de verdad: lo que
 *     llega en el aviso del webhook o en la URL de regreso no se cree.
 *   - verifyWebhookSignature(): comprueba que el aviso venga de Mercado Pago.
 *
 * Credenciales (solo servidor): MERCADOPAGO_ACCESS_TOKEN y
 * MERCADOPAGO_WEBHOOK_SECRET. Las de PRUEBA y las reales se usan igual: lo
 * que cambia es el valor de la variable.
 */

const API = "https://api.mercadopago.com";

/** Error de la API. `transient` = vale la pena reintentar (MP caído, límite, red). */
export class MercadoPagoError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    readonly transient: boolean,
  ) {
    super(message);
    this.name = "MercadoPagoError";
  }
}

async function mpFetch(path: string, init: RequestInit = {}): Promise<Response> {
  // Fuera del try: si falta la variable, el error tiene que decir CUÁL
  // (no confundirse con "no se pudo conectar").
  const token = requireEnv("MERCADOPAGO_ACCESS_TOKEN");
  try {
    return await fetch(`${API}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...init.headers,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new MercadoPagoError("No se pudo conectar con Mercado Pago.", null, true);
  }
}

function failed(res: Response, what: string): MercadoPagoError {
  const transient = res.status >= 500 || res.status === 429;
  return new MercadoPagoError(`${what}: Mercado Pago respondió ${res.status}.`, res.status, transient);
}

const mpErrorBody = z
  .object({
    message: z.string().optional(),
    error: z.string().optional(),
    cause: z
      .array(z.object({ code: z.union([z.string(), z.number()]).optional(), description: z.string().optional() }))
      .optional(),
  })
  .loose();

/**
 * Escribe en la consola del servidor POR QUÉ Mercado Pago rechazó un pedido
 * a su API: status, mensaje y causas. Nunca el Access Token ni los headers.
 */
async function logMpError(context: string, res: Response): Promise<void> {
  const raw = await res.text().catch(() => "");
  let detail: string = raw.slice(0, 500);
  try {
    const body = mpErrorBody.parse(JSON.parse(raw));
    const causes = (body.cause ?? []).map((c) => [c.code, c.description].filter(Boolean).join(": ")).filter(Boolean);
    detail = [body.error, body.message, ...causes].filter(Boolean).join(" | ") || detail;
  } catch {
    // No vino JSON: queda el texto (recortado).
  }
  console.error(`[mercadopago] ${context}: status ${res.status} — ${detail}`);
}

// ---------------------------------------------------------------------------
// ¿Credenciales de prueba?
// ---------------------------------------------------------------------------

const userSchema = z.object({ tags: z.array(z.string()).optional() }).loose();

let testModePromise: Promise<boolean> | null = null;

/**
 * true si el Access Token es de PRUEBA:
 *   - credenciales de prueba clásicas: empiezan con "TEST-";
 *   - credenciales de un usuario de prueba (vendedor de prueba): empiezan con
 *     "APP_USR-" como las reales, así que se le pregunta a MP de quién es la
 *     cuenta (/users/me): los usuarios de prueba vienen con la marca "test_user".
 *
 * Se averigua una vez y queda en memoria (cambiar el token = reiniciar el
 * servidor, que es lo que pasa al cambiar variables). Si MP no responde, se
 * asume producción (el comportamiento normal) y se vuelve a intentar la
 * próxima vez.
 */
export function isTestCredentials(): Promise<boolean> {
  if (requireEnv("MERCADOPAGO_ACCESS_TOKEN").startsWith("TEST-")) return Promise.resolve(true);
  testModePromise ??= (async () => {
    const res = await mpFetch("/users/me");
    if (!res.ok) {
      await logMpError("consulta de la cuenta", res);
      throw failed(res, "No se pudo consultar la cuenta");
    }
    const user = userSchema.parse(await res.json());
    return (user.tags ?? []).includes("test_user");
  })();
  return testModePromise.catch(() => {
    testModePromise = null;
    return false;
  });
}

// ---------------------------------------------------------------------------
// Preferencia (link de pago)
// ---------------------------------------------------------------------------

export type PreferenceInput = {
  items: { id: string; title: string; quantity: number; unit_price: number }[];
  /** Sin email con credenciales de prueba (ver startCheckout). */
  payer: { name: string; email?: string; phone?: { area_code: string; number: string } };
  external_reference: string;
  back_urls?: { success: string; pending: string; failure: string };
  auto_return?: "approved";
  notification_url?: string;
  statement_descriptor: string;
  expires: boolean;
  expiration_date_from: string;
  expiration_date_to: string;
  payment_methods: { excluded_payment_types: { id: string }[]; installments?: number };
  metadata?: Record<string, string | number>;
};

const preferenceResponse = z.object({ id: z.string(), init_point: z.url() });

export async function createPreference(
  input: PreferenceInput,
  idempotencyKey: string,
): Promise<z.infer<typeof preferenceResponse>> {
  const items = input.items.map((i) => ({ ...i, currency_id: "ARS" }));
  const res = await mpFetch("/checkout/preferences", {
    method: "POST",
    // Si el mismo pedido se reintenta, MP devuelve la misma preferencia.
    headers: { "X-Idempotency-Key": idempotencyKey },
    body: JSON.stringify({ ...input, items }),
  });
  if (!res.ok) {
    // El detalle va al log del servidor (nunca al cliente).
    await logMpError("preferencia rechazada", res);
    throw failed(res, "No se pudo crear el pago");
  }
  const parsed = preferenceResponse.safeParse(await res.json());
  if (!parsed.success) throw new MercadoPagoError("Respuesta inesperada de Mercado Pago.", res.status, false);
  return parsed.data;
}

/**
 * Fecha en el formato que pide MP (ISO 8601 con zona horaria), en hora de
 * Argentina (UTC−3, sin horario de verano).
 */
export function mpDate(date: Date): string {
  return new Date(date.getTime() - 3 * 60 * 60 * 1000).toISOString().replace("Z", "-03:00");
}

// ---------------------------------------------------------------------------
// Pago
// ---------------------------------------------------------------------------

const paymentSchema = z.object({
  id: z.union([z.number(), z.string()]).transform(String),
  status: z.string(),
  status_detail: z.string().nullish(),
  external_reference: z.string().nullish(),
  // Lo que se cobró por el pedido, SIN intereses de cuotas (eso va aparte,
  // en transaction_details.total_paid_amount). Se compara con el total.
  transaction_amount: z.number(),
  currency_id: z.string(),
});

export type MpPayment = z.infer<typeof paymentSchema>;

/** Consulta un pago. null si no existe (ej.: el "Simular notificación" del panel de MP). */
export async function getPayment(paymentId: string): Promise<MpPayment | null> {
  const res = await mpFetch(`/v1/payments/${encodeURIComponent(paymentId)}`);
  if (res.status === 404) return null;
  if (!res.ok) {
    await logMpError("consulta de pago rechazada", res);
    throw failed(res, "No se pudo consultar el pago");
  }
  const parsed = paymentSchema.safeParse(await res.json());
  if (!parsed.success) throw new MercadoPagoError("Respuesta inesperada de Mercado Pago.", res.status, false);
  return parsed.data;
}

// ---------------------------------------------------------------------------
// Firma del webhook
// ---------------------------------------------------------------------------

/**
 * Verifica el encabezado x-signature ("ts=...,v1=...") según la
 * documentación de MP: HMAC-SHA256, con la clave secreta del webhook, de
 *   id:{data.id};request-id:{x-request-id};ts:{ts};
 * (si falta algún dato, ese tramo no va). data.id alfanumérico va en minúsculas.
 */
export function verifyWebhookSignature({
  xSignature,
  xRequestId,
  dataId,
}: {
  xSignature: string | null;
  xRequestId: string | null;
  dataId: string | null;
}): boolean {
  if (!xSignature) return false;
  const parts = new Map(
    xSignature.split(",").map((part) => {
      const [k, ...v] = part.split("=");
      return [k.trim(), v.join("=").trim()] as const;
    }),
  );
  const ts = parts.get("ts");
  const v1 = parts.get("v1");
  if (!ts || !v1 || !/^[0-9a-f]{64}$/i.test(v1)) return false;

  let manifest = "";
  if (dataId) manifest += `id:${/^[a-z0-9]+$/i.test(dataId) ? dataId.toLowerCase() : dataId};`;
  if (xRequestId) manifest += `request-id:${xRequestId};`;
  manifest += `ts:${ts};`;

  const expected = createHmac("sha256", requireEnv("MERCADOPAGO_WEBHOOK_SECRET")).update(manifest).digest();
  const received = Buffer.from(v1, "hex");
  // Comparación en tiempo constante (no da pistas a quien intente adivinar).
  return received.length === expected.length && timingSafeEqual(received, expected);
}
