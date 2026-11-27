import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { GETNET_PATHS, getnetConfig, type GetnetConfig } from "./config";

/**
 * GETNET WEB CHECKOUT (Argentina), con su API REST directa (sin SDK).
 *
 *   - getAccessToken(): token OAuth (client_credentials), cacheado en memoria.
 *   - createPaymentIntent(): crea el pago y devuelve la página segura de
 *     Getnet (modo redirect).
 *   - verifyBasicAuth() + parseWebhook(): el aviso del pago (webhook).
 *
 * Seguridad: el client_secret y el token NUNCA salen del servidor ni van a
 * los logs. Tampoco nombre, email, DNI ni dirección del cliente.
 *
 * Fuente: docs.globalgetnet.com/es/products/online-payments/web-checkout.
 * Lo que la doc no deja claro está marcado "A CONFIRMAR".
 */

/** Error de la API. `transient` = vale la pena reintentar (Getnet caído, límite, red). */
export class GetnetError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    readonly transient: boolean,
  ) {
    super(message);
    this.name = "GetnetError";
  }
}

function requireConfig(config: GetnetConfig | null): GetnetConfig {
  if (!config) throw new GetnetError("Getnet no está configurado (faltan variables GETNET_*).", null, false);
  return config;
}

async function getnetFetch(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, { ...init, cache: "no-store", signal: AbortSignal.timeout(15_000) });
  } catch {
    throw new GetnetError("No se pudo conectar con Getnet.", null, true);
  }
}

function failed(res: Response, what: string): GetnetError {
  const transient = res.status >= 500 || res.status === 429;
  return new GetnetError(`${what}: Getnet respondió ${res.status}.`, res.status, transient);
}

const errorBody = z
  .object({ message: z.string().optional(), error: z.string().optional(), error_description: z.string().optional() })
  .loose();

/**
 * Escribe POR QUÉ Getnet rechazó un pedido: status y mensaje de error. Nunca
 * el cuerpo completo (podría repetir datos del cliente), ni headers ni token.
 */
async function logGetnetError(context: string, res: Response): Promise<void> {
  const raw = await res.text().catch(() => "");
  let detail = "";
  try {
    const body = errorBody.parse(JSON.parse(raw));
    detail = [body.error, body.error_description, body.message].filter(Boolean).join(" | ").slice(0, 300);
  } catch {
    // No vino JSON: no se loguea el texto (puede traer cualquier cosa).
  }
  console.error(`[getnet] ${context}: status ${res.status}${detail ? ` — ${detail}` : ""}`);
}

// ---------------------------------------------------------------------------
// Token OAuth (authentication-wbc)
// ---------------------------------------------------------------------------

const tokenSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.coerce.number().positive(),
  token_type: z.string().optional(),
});

/** Margen para renovarlo antes de que venza (la doc pide renovarlo antes de los 60 min). */
const TOKEN_MARGIN_S = 60;

let cachedToken: { key: string; token: string; expiresAt: number } | null = null;
let inflight: { key: string; promise: Promise<string> } | null = null;

/** Solo para tests. */
export function resetGetnetTokenCache(): void {
  cachedToken = null;
  inflight = null;
}

async function requestToken(config: GetnetConfig): Promise<{ token: string; expiresIn: number }> {
  const res = await getnetFetch(`${config.apiBase}${GETNET_PATHS.token}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: config.clientId,
      client_secret: config.clientSecret,
    }).toString(),
  });
  if (!res.ok) {
    await logGetnetError("token rechazado", res);
    throw failed(res, "No se pudo obtener el token");
  }
  const parsed = tokenSchema.safeParse(await res.json().catch(() => null));
  if (!parsed.success) throw new GetnetError("Respuesta inesperada de Getnet (token).", res.status, false);
  return { token: parsed.data.access_token, expiresIn: parsed.data.expires_in };
}

/**
 * Token vigente. Se pide una vez y se reusa hasta 1 minuto antes de que
 * venza. Si llegan dos pedidos juntos, comparten el mismo pedido de token.
 */
export async function getAccessToken(config: GetnetConfig | null = getnetConfig()): Promise<string> {
  const cfg = requireConfig(config);
  // Si cambian las credenciales o el ambiente, no se reusa el token viejo.
  const key = `${cfg.env}:${cfg.clientId}`;
  if (cachedToken && cachedToken.key === key && Date.now() < cachedToken.expiresAt) return cachedToken.token;
  if (inflight && inflight.key === key) return inflight.promise;

  const promise = requestToken(cfg)
    .then(({ token, expiresIn }) => {
      cachedToken = { key, token, expiresAt: Date.now() + Math.max(expiresIn - TOKEN_MARGIN_S, 30) * 1000 };
      return token;
    })
    .finally(() => {
      if (inflight?.promise === promise) inflight = null;
    });
  inflight = { key, promise };
  return promise;
}

/**
 * "Probar conexión" (sección de desarrollador): pide un token NUEVO (sin
 * caché). No crea pagos ni cobra nada.
 */
export async function testGetnetConnection(): Promise<{ ok: true } | { ok: false; error: string }> {
  const config = getnetConfig();
  if (!config) return { ok: false, error: "Faltan credenciales de Getnet." };
  try {
    await requestToken(config);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof GetnetError ? e.message : "Error inesperado al conectar con Getnet." };
  }
}

// ---------------------------------------------------------------------------
// Montos
// ---------------------------------------------------------------------------

/**
 * La doc: "payment.amount" es un entero donde los 2 últimos dígitos son los
 * centavos ($ 141,00 → 14100). A CONFIRMAR en la primera compra real: los
 * ejemplos de webhook en ARS de la doc no coinciden entre sí (14100 y 1410000).
 */
export function toCents(amount: number): number {
  return Math.round(amount * 100);
}

export function fromCents(cents: number): number {
  return cents / 100;
}

// ---------------------------------------------------------------------------
// Payment intent (quickstart-create-a-payment-wbc)
// ---------------------------------------------------------------------------

/** Referencia del pedido para Getnet ("HD-1023"). Vuelve en el webhook como order_id. */
export function getnetOrderReference(orderNumber: number): string {
  return `HD-${orderNumber}`;
}

export type PaymentIntentInput = {
  /** Referencia del pedido para Getnet (vuelve en el webhook como order_id). */
  orderReference: string;
  /** Total del pedido en pesos (se manda en centavos). */
  total: number;
  customer: {
    name: string;
    email: string;
    dni: string;
    phone?: string;
  };
  billing: { street: string; number: string; postalCode: string };
  successUrl?: string;
  errorUrl?: string;
  /** "2h" (formato de la doc). Sin esto, el intent no vence. */
  expiresIn?: string;
};

const intentResponse = z.object({
  payment_intent_id: z.string().min(1),
  redirect_url: z.url(),
});

export type PaymentIntent = { paymentIntentId: string; redirectUrl: string };

/** "Ana María López" → first "Ana", last "María López". Con una sola palabra, se repite. */
export function splitName(full: string): { first: string; last: string } {
  const parts = full.trim().split(/\s+/);
  const first = parts[0] ?? "";
  const last = parts.slice(1).join(" ") || first;
  return { first, last };
}

/** Arma el cuerpo del intent (separado para poder probarlo sin red). */
export function buildIntentBody(input: PaymentIntentInput) {
  const { first, last } = splitName(input.customer.name);
  return {
    // Aparece en el ejemplo oficial; A CONFIRMAR si es obligatorio u opcional.
    mode: "instant",
    // Conciliación del webhook: la doc dice que vuelve en el aviso.
    // A CONFIRMAR: largo máximo y caracteres permitidos (no aparecen en la doc).
    order_id: input.orderReference,
    payment: {
      amount: toCents(input.total),
      currency: "ARS",
    },
    customer: {
      // La doc recomienda el número de documento (solo letras y números).
      customer_id: input.customer.dni,
      first_name: first,
      last_name: last,
      name: input.customer.name.trim(),
      email: input.customer.email,
      document_type: "DNI",
      document_number: input.customer.dni,
      ...(input.customer.phone ? { phone_number: input.customer.phone } : {}),
      billing_address: {
        street: input.billing.street,
        number: input.billing.number,
        country: "AR",
        postal_code: input.billing.postalCode,
      },
    },
    ...(input.successUrl || input.errorUrl
      ? {
          configurations: {
            ...(input.successUrl ? { success_url: input.successUrl } : {}),
            ...(input.errorUrl ? { error_url: input.errorUrl } : {}),
          },
        }
      : {}),
    ...(input.expiresIn ? { expires_at: input.expiresIn } : {}),
  };
}

/**
 * CUOTAS (preparado, TODAVÍA NO SE USA).
 *
 * Desde checkout-cuotas el pedido guarda la forma de pago (orders.payment_plan
 * e installments) y create_order ya calcula el total de cuotas (precio de
 * lista). Hoy createPaymentIntent manda SOLO el total del pedido: el cliente
 * elige las cuotas en la pantalla de Getnet.
 *
 * TODO(Getnet): cuando confirmemos con Getnet el formato para fijar la
 * cantidad de cuotas del intent (nombre del campo, si va dentro de "payment",
 * si exige plan sin interés acordado, qué pasa si el cliente elige otra
 * cantidad), devolver acá el fragmento y sumarlo en buildIntentBody:
 *   ...installmentsForIntent(plan)
 * Hasta entonces, "Cuotas sin interés" queda APAGADO en Configuración.
 */
export function installmentsForIntent(plan: {
  paymentPlan: "single" | "installments";
  installments: number | null;
}): Record<string, unknown> {
  // TODO(Getnet): formato A CONFIRMAR. Por ahora no se manda nada.
  void plan;
  return {};
}

export async function createPaymentIntent(
  input: PaymentIntentInput,
  config: GetnetConfig | null = getnetConfig(),
): Promise<PaymentIntent> {
  const cfg = requireConfig(config);
  const body = buildIntentBody(input);

  if (process.env.NODE_ENV !== "production") {
    // Para revisar el formato del monto (A CONFIRMAR). Sin datos personales.
    console.info(
      `[getnet] intent amount=${body.payment.amount} currency=${body.payment.currency} order=${input.orderReference}`,
    );
  }

  const token = await getAccessToken(cfg);
  const res = await getnetFetch(`${cfg.apiBase}${GETNET_PATHS.paymentIntent}`, {
    method: "POST",
    headers: {
      // A CONFIRMAR: la guía del intent no muestra el prefijo; el resto de la doc usa "Bearer".
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    await logGetnetError("payment intent rechazado", res);
    throw failed(res, "No se pudo crear el pago");
  }
  const parsed = intentResponse.safeParse(await res.json().catch(() => null));
  if (!parsed.success) throw new GetnetError("Respuesta inesperada de Getnet (payment intent).", res.status, false);
  return { paymentIntentId: parsed.data.payment_intent_id, redirectUrl: parsed.data.redirect_url };
}

// ---------------------------------------------------------------------------
// Webhook (receive-webhook-payment-data-wbc)
// ---------------------------------------------------------------------------

function sha256(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

/**
 * Authorization: Basic base64(usuario:contraseña), con los datos cargados en
 * el portal de Getnet. Se comparan los hash (mismo largo siempre) en tiempo
 * constante.
 */
export function verifyBasicAuth(header: string | null, user: string, password: string): boolean {
  if (!header || !user || !password) return false;
  const match = /^Basic\s+([A-Za-z0-9+/=_-]+)\s*$/i.exec(header);
  if (!match) return false;
  let received: string;
  try {
    received = Buffer.from(match[1], "base64").toString("utf8");
  } catch {
    return false;
  }
  return timingSafeEqual(sha256(received), sha256(`${user}:${password}`));
}

/** Lo que usamos del aviso. El resto de los campos se ignora (no se guarda ni se loguea). */
const webhookSchema = z
  .object({
    payment_intent_id: z.string().min(1).max(200),
    order_id: z.string().max(200).nullish(),
    payment: z
      .object({
        amount: z.number().int().nonnegative(),
        currency: z.string().max(10),
        result: z
          .object({
            payment_id: z.union([z.string(), z.number()]).transform(String).nullish(),
            status: z.string().max(50),
            return_message: z.string().max(300).nullish(),
          })
          .loose(),
      })
      .loose(),
  })
  .loose();

export type GetnetWebhook = z.output<typeof webhookSchema>;

export function parseWebhook(body: unknown): GetnetWebhook | null {
  const parsed = webhookSchema.safeParse(body);
  return parsed.success ? parsed.data : null;
}

/**
 * Estado de Getnet → estado que entiende apply_order_payment.
 * Documentados: "Authorized" / "Denied" (tarjeta) y "Approved" / "Denied" (QR).
 * A CONFIRMAR: si "Authorized" ya es un pago acreditado (la doc no menciona
 * captura para Web Checkout; la preautorización no está disponible en Argentina).
 */
export function normalizeStatus(status: string): "approved" | "rejected" | null {
  switch (status.trim().toLowerCase()) {
    case "authorized":
    case "approved":
      return "approved";
    case "denied":
      return "rejected";
    default:
      return null;
  }
}
