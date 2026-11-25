/**
 * Respuestas SIMULADAS de Getnet, con la forma de los ejemplos de la doc
 * oficial (docs.globalgetnet.com/es/products/online-payments/web-checkout:
 * authentication-wbc, quickstart-create-a-payment-wbc,
 * receive-webhook-payment-data-wbc). Datos de "prueba-": nada real.
 */

export const TEST_ENV = {
  GETNET_CLIENT_ID: "prueba-client-id",
  GETNET_CLIENT_SECRET: "prueba-SECRETO-no-loguear",
  GETNET_ENV: "sandbox",
  GETNET_WEBHOOK_USER: "prueba-webhook",
  GETNET_WEBHOOK_PASSWORD: "prueba-clave-webhook",
} as const;

export function stubGetnetEnv(stub: (name: string, value: string) => void) {
  for (const [name, value] of Object.entries(TEST_ENV)) stub(name, value);
}

export const tokenResponse = (accessToken = "prueba-token-1", expiresIn = 3599) => ({
  access_token: accessToken,
  scope: "name-scope:r",
  token_type: "Bearer",
  expires_in: expiresIn,
});

export const intentResponse = {
  payment_intent_id: "prueba-intent-0001",
  trade_name: "Home Deko",
  redirect_url: "https://www.pre.globalgetnet.com/hosted-web-checkout/prueba-intent-0001",
};

export const CUSTOMER = {
  name: "Prueba Cliente Apellido",
  email: "prueba-cliente@example.com",
  dni: "30123456",
  phone: "2945123456",
};

/** Aviso del webhook (tarjeta). status: "Authorized" | "Denied". */
export function webhookPayload({
  intentId = "prueba-intent-0001",
  orderId = "HD-1001",
  amount = 1234567,
  currency = "ARS",
  status = "Authorized",
  paymentId = "prueba-pago-1",
  returnMessage = "Transacción aprobada",
}: {
  intentId?: string;
  orderId?: string | null;
  amount?: number;
  currency?: string;
  status?: string;
  paymentId?: string;
  returnMessage?: string;
} = {}) {
  return {
    payment_intent_id: intentId,
    checkout_id: "prueba-checkout-1",
    ...(orderId === null ? {} : { order_id: orderId }),
    mode: "instant",
    seller: { id: "prueba-seller", trade_name: "Home Deko" },
    // Datos personales: el webhook NO los usa ni los loguea (lo controla el test).
    customer: {
      customer_id: CUSTOMER.dni,
      first_name: "Prueba",
      last_name: "Cliente Apellido",
      name: CUSTOMER.name,
      email: CUSTOMER.email,
      document_type: "DNI",
      document_number: CUSTOMER.dni,
    },
    payment: {
      method: "credit",
      amount,
      currency,
      installment: { number: 3, type: "without_interest" },
      result: {
        payment_id: paymentId,
        status,
        authorization_code: "000000",
        transaction_datetime: "2026-11-25T12:00:00Z",
        return_message: returnMessage,
      },
    },
    created_at: "2026-11-25T12:00:00Z",
    updated_at: "2026-11-25T12:00:05Z",
  };
}

export function basicAuth(user: string = TEST_ENV.GETNET_WEBHOOK_USER, password: string = TEST_ENV.GETNET_WEBHOOK_PASSWORD) {
  return `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}`;
}

/** Todo lo que se escribió en la consola, en un solo texto (para buscar datos que no deberían estar). */
export function consoleText(spies: { mock: { calls: unknown[][] } }[]): string {
  return spies
    .flatMap((s) => s.mock.calls)
    .map((args) => args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" "))
    .join("\n");
}
