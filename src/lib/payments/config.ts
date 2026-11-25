import "server-only";

/**
 * MEDIO DE PAGO DE LA TIENDA — único lugar con la configuración.
 *
 *   PAYMENT_PROVIDER = "getnet" (por defecto) | "mercadopago"
 *
 * El código de Mercado Pago sigue entero (src/lib/mercadopago.ts y
 * /api/mercadopago/webhook): para volver a usarlo alcanza con cambiar la
 * variable (y tener sus credenciales cargadas).
 *
 * Getnet Web Checkout (Argentina). Fuente: docs.globalgetnet.com/es/products/
 * online-payments/web-checkout (authentication-wbc, quickstart-create-a-payment-wbc,
 * receive-webhook-payment-data-wbc). Lo marcado "A CONFIRMAR" no está claro
 * en la doc oficial y hay que validarlo con Getnet antes de la primera venta.
 */

export type PaymentProvider = "getnet" | "mercadopago";

export function paymentProvider(): PaymentProvider {
  return process.env.PAYMENT_PROVIDER?.trim().toLowerCase() === "mercadopago" ? "mercadopago" : "getnet";
}

// ---------------------------------------------------------------------------
// Getnet: ambientes
// ---------------------------------------------------------------------------

export type GetnetEnv = "sandbox" | "production";

/**
 * Hosts de la API según la doc (authentication-wbc):
 *   homologación → https://api.pre.globalgetnet.com
 *   producción   → https://api.globalgetnet.com
 */
export const GETNET_HOSTS: Record<GetnetEnv, string> = {
  sandbox: "https://api.pre.globalgetnet.com",
  production: "https://api.globalgetnet.com",
};

export const GETNET_PATHS = {
  /** POST, form-urlencoded: grant_type=client_credentials, client_id, client_secret. */
  token: "/authentication/oauth2/access_token",
  /**
   * POST con Bearer. A CONFIRMAR: la doc (quickstart-create-a-payment-wbc)
   * dice solo "POST /payment-intent", sin el prefijo. Otras páginas usan
   * "/dpy/web-checkout/v1/…" (configuración) y "/digital-checkout/v1/…"
   * (ejemplos del webhook). Si Getnet confirma otro prefijo, se cambia SOLO acá.
   */
  paymentIntent: "/payment-intent",
} as const;

/** El intent vence a las 2 h (como la preferencia de Mercado Pago). Formato de la doc: "15m", "2h", "7d". */
export const GETNET_INTENT_EXPIRES = "2h";
export const GETNET_INTENT_TTL_MS = 2 * 60 * 60 * 1000;

export type GetnetConfig = {
  env: GetnetEnv;
  apiBase: string;
  clientId: string;
  clientSecret: string;
  webhookUser: string;
  webhookPassword: string;
};

const GETNET_VARS = [
  "GETNET_CLIENT_ID",
  "GETNET_CLIENT_SECRET",
  "GETNET_ENV",
  "GETNET_WEBHOOK_USER",
  "GETNET_WEBHOOK_PASSWORD",
] as const;

/** Qué variables de Getnet faltan (solo nombres, nunca valores). */
export function missingGetnetVars(): string[] {
  const missing: string[] = GETNET_VARS.filter((name) => !process.env[name]?.trim());
  const env = process.env.GETNET_ENV?.trim();
  if (env && env !== "sandbox" && env !== "production") missing.push("GETNET_ENV (sandbox | production)");
  return missing;
}

/** La configuración de Getnet, o null si falta alguna variable. */
export function getnetConfig(): GetnetConfig | null {
  if (missingGetnetVars().length > 0) return null;
  const env = process.env.GETNET_ENV!.trim() as GetnetEnv;
  return {
    env,
    apiBase: GETNET_HOSTS[env],
    clientId: process.env.GETNET_CLIENT_ID!.trim(),
    clientSecret: process.env.GETNET_CLIENT_SECRET!.trim(),
    webhookUser: process.env.GETNET_WEBHOOK_USER!,
    webhookPassword: process.env.GETNET_WEBHOOK_PASSWORD!,
  };
}

/** ¿El medio de pago activo tiene sus credenciales? Si no, el checkout no ofrece pagar online. */
export function onlinePaymentsAvailable(): boolean {
  if (paymentProvider() === "getnet") return getnetConfig() !== null;
  return Boolean(process.env.MERCADOPAGO_ACCESS_TOKEN && process.env.MERCADOPAGO_WEBHOOK_SECRET);
}

// ---------------------------------------------------------------------------
// Textos según el medio de pago (tienda y panel)
// ---------------------------------------------------------------------------

export type PaymentCopy = {
  provider: PaymentProvider;
  /** Nombre para el panel y los legales ("Getnet", "Mercado Pago"). */
  name: string;
  /** Botón del checkout. */
  payButton: string;
  /** Mientras redirige. */
  redirecting: string;
  /** Debajo del botón. */
  secureNote: string;
  /** Cuotas: Getnet las muestra recién al pagar. */
  installments: string;
  /** ¿El checkout pide DNI y dirección de facturación? (Getnet los exige). */
  requiresBilling: boolean;
  /** Panel: cómo devolver el dinero (completa la frase "hacé la devolución …"). */
  refundHow: string;
};

export function paymentCopy(provider: PaymentProvider = paymentProvider()): PaymentCopy {
  if (provider === "mercadopago") {
    return {
      provider,
      name: "Mercado Pago",
      payButton: "Pagar con Mercado Pago",
      redirecting: "Te llevamos a Mercado Pago…",
      secureNote: "Pagás de forma segura en Mercado Pago, con tarjeta de crédito, débito o dinero en tu cuenta.",
      installments: "Las cuotas disponibles las muestra Mercado Pago al momento de pagar.",
      requiresBilling: false,
      refundHow: "desde tu cuenta de Mercado Pago (Actividad → el pago → Devolver dinero)",
    };
  }
  return {
    provider,
    name: "Getnet",
    payButton: "Ir a pagar",
    redirecting: "Te llevamos al pago seguro…",
    secureNote: "Pagás de forma segura con tarjeta de crédito o débito, en la página de pago de Getnet.",
    installments: "Pagá con tarjeta de crédito o débito. Las cuotas disponibles se ven al momento de pagar.",
    requiresBilling: true,
    refundHow: "desde el portal de Getnet (buscá la operación por su n.º)",
  };
}
