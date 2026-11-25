"use server";

import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import {
  billingFrom,
  checkoutSchemaFor,
  couponCodeSchema,
  fieldErrorsFrom,
  itemsSchema,
  PAYMENTS_UNAVAILABLE_MESSAGE,
  type CheckoutResult,
  type CouponCheckResult,
} from "@/lib/checkout-schema";
import { allowCouponAttempt } from "@/lib/coupon-rate-limit";
import { COUPON_RATE_LIMIT_MESSAGE, couponErrorMessage, type CouponQuote, type CouponQuoteError } from "@/lib/coupons";
import { createPreference, isTestCredentials, mpDate, type PreferenceInput } from "@/lib/mercadopago";
import { createOrderToken, orderPath } from "@/lib/order-token";
import {
  GETNET_INTENT_EXPIRES,
  GETNET_INTENT_TTL_MS,
  onlinePaymentsAvailable,
  paymentCopy,
  paymentProvider,
} from "@/lib/payments/config";
import { createPaymentIntent, getnetOrderReference } from "@/lib/payments/getnet";
import { notificationBaseUrl, siteUrl } from "@/lib/site-url";
import { createAdminClient } from "@/lib/supabase/admin";

/** La preferencia (link de pago) vence a las 2 horas: nadie paga después un precio viejo. */
const PREFERENCE_TTL_MS = 2 * 60 * 60 * 1000;

const GENERIC_ERROR = "No pudimos iniciar el pago. Probá de nuevo en unos minutos o escribinos por WhatsApp.";

type CheckoutData = z.output<ReturnType<typeof checkoutSchemaFor>>;
type AdminClient = ReturnType<typeof createAdminClient>;

/**
 * "Ir a pagar".
 *
 * 1. Valida los datos (zod). Con Getnet, también DNI y facturación.
 * 2. create_order (en la base): precios de store_variants, envío de
 *    Configuración, verifica stock. El total lo calcula la base.
 * 3. Crea el pago en el proveedor activo (PAYMENT_PROVIDER) con lo GUARDADO
 *    en el pedido: payment intent de Getnet o preferencia de Mercado Pago.
 * 4. Devuelve el link de pago; el navegador redirige.
 *
 * El pago NO se confirma acá ni al volver: solo el webhook del proveedor
 * (src/app/api/getnet/webhook o src/app/api/mercadopago/webhook) lo
 * confirma y descuenta stock.
 */
export async function startCheckout(input: unknown): Promise<CheckoutResult> {
  const provider = paymentProvider();
  // Sin credenciales: no se crea ningún pedido; se ofrece WhatsApp.
  if (!onlinePaymentsAvailable()) {
    console.warn(`[checkout] pagos online no disponibles: faltan credenciales de ${provider}`);
    return { ok: false, error: PAYMENTS_UNAVAILABLE_MESSAGE, paymentsUnavailable: true };
  }

  const requireBilling = paymentCopy(provider).requiresBilling;
  const parsed = checkoutSchemaFor(requireBilling).safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Revisá los datos marcados.", fieldErrors: fieldErrorsFrom(parsed.error) };
  }
  const data = parsed.data;
  const billing = requireBilling ? billingFrom(data) : null;
  if (requireBilling && !billing) {
    return { ok: false, error: "Revisá los datos marcados.", fieldErrors: { dni: "Revisá tu DNI y la dirección." } };
  }

  const base = siteUrl();
  const notifyBase = notificationBaseUrl();
  if (!base || !notifyBase) {
    // Para Leo: falta NEXT_PUBLIC_SITE_URL.
    console.error("[checkout] falta NEXT_PUBLIC_SITE_URL");
    return { ok: false, error: GENERIC_ERROR };
  }

  const user = await getCurrentUser();
  // El id lo arma el servidor ANTES de crear el pedido: el link secreto se
  // deriva de él (ver src/lib/order-token.ts).
  const newOrderId = crypto.randomUUID();
  let token: string;
  let hash: string;
  try {
    ({ token, hash } = createOrderToken(newOrderId));
  } catch (e) {
    // Para Leo: falta ORDER_LINK_SECRET (el mensaje dice cuál).
    console.error("[checkout]", e instanceof Error ? e.message : e);
    return { ok: false, error: GENERIC_ERROR };
  }
  const supabase = createAdminClient();
  const couponCode = data.couponCode || null;

  // Con cupón, el pago también cuenta como intento: si no, se podrían
  // probar códigos al azar directo desde "Pagar".
  if (couponCode && !(await allowCouponAttempt(supabase))) {
    return { ok: false, error: COUPON_RATE_LIMIT_MESSAGE, couponError: COUPON_RATE_LIMIT_MESSAGE };
  }

  // ---- 1. Pedido en la base -------------------------------------------
  const { data: created, error } = await supabase.rpc("create_order", {
    p: {
      id: newOrderId,
      access_token_hash: hash,
      created_by: user?.id ?? null,
      // Dueño del pedido ("Mis pedidos"): SIEMPRE el de la sesión verificada,
      // nunca algo que venga del formulario.
      customer_id: user?.id ?? null,
      customer_name: data.name,
      customer_email: data.email,
      customer_phone: data.phone,
      delivery_method: data.delivery,
      ship_address: data.address ?? null,
      ship_apartment: data.apartment || null,
      ship_notes: data.notes || null,
      ship_city: data.city ?? null,
      ship_province: data.province ?? null,
      ship_postal_code: data.postalCode ?? null,
      items: data.items.map((i) => ({ variant_id: i.variantId, qty: i.qty })),
      // Solo el código: la base vuelve a validar el cupón y calcula el descuento.
      coupon_code: couponCode,
      payment_provider: provider,
      customer_dni: billing?.dni ?? null,
      billing_street: billing?.street ?? null,
      billing_number: billing?.number ?? null,
      billing_postal_code: billing?.postalCode ?? null,
    },
  });

  if (error || !created?.[0]) {
    if (error?.message === "cupon") {
      // El cupón dejó de valer entre "Aplicar" y "Pagar" (venció, se agotó…).
      // No se cobra un precio distinto del que vio el cliente: se le avisa.
      const message = couponErrorMessage(parseQuoteError(error.details));
      return { ok: false, error: message, couponError: message };
    }
    if (error?.message === "sin_stock" || error?.message === "no_disponible") {
      return {
        ok: false,
        cartChanged: true,
        error:
          error.message === "sin_stock"
            ? "Mientras completabas tus datos, se vendieron unidades de un producto. Actualizamos tu carrito: revisalo y volvé a intentar."
            : "Un producto de tu carrito ya no está disponible. Actualizamos tu carrito: revisalo y volvé a intentar.",
      };
    }
    if (error?.message === "carrito_vacio") return { ok: false, cartChanged: true, error: "Tu carrito está vacío." };
    if (error?.message === "datos_pago") {
      return { ok: false, error: "Revisá los datos marcados.", fieldErrors: { dni: "Revisá tu DNI y la dirección." } };
    }
    // Sin datos del cliente en el log (solo código y mensaje de la base).
    console.error("[checkout] create_order", error?.code, error?.message);
    return { ok: false, error: GENERIC_ERROR };
  }

  const { order_id: orderId, order_number: orderNumber } = created[0];

  // Con sesión y "Guardar estos datos en mi cuenta": actualiza "Mis datos".
  // Si falla, la compra sigue igual (no es parte del pago).
  if (user && data.saveToAccount) await saveCheckoutToAccount(supabase, user.id, data);

  const returnUrl = `${base}${orderPath(orderId, token)}`;
  const orderUrl = orderPath(orderId, token);

  if (provider === "getnet") {
    return startGetnetPayment({ supabase, orderId, orderNumber, orderUrl, returnUrl, data, billing: billing! });
  }
  return startMercadoPagoPayment({ supabase, orderId, orderNumber, orderUrl, returnUrl, notifyBase, data });
}

type PaymentStart = {
  supabase: AdminClient;
  orderId: string;
  orderNumber: number;
  /** /pedido/{id}?t=… (relativo, para el navegador). */
  orderUrl: string;
  /** Lo mismo, con el dominio (para el proveedor). */
  returnUrl: string;
  data: CheckoutData;
};

// ---------------------------------------------------------------------------
// Getnet (Web Checkout, modo redirect)
// ---------------------------------------------------------------------------

async function startGetnetPayment({
  supabase,
  orderId,
  orderNumber,
  orderUrl,
  returnUrl,
  data,
  billing,
}: PaymentStart & { billing: NonNullable<ReturnType<typeof billingFrom>> }): Promise<CheckoutResult> {
  // El total que se cobra es el GUARDADO en el pedido (lo calculó la base).
  const { data: order } = await supabase.from("orders").select("total").eq("id", orderId).single();
  if (!order) {
    console.error("[checkout] no se pudo releer el pedido", orderId);
    return { ok: false, error: GENERIC_ERROR };
  }

  // Sin https (local), no se mandan las URLs de regreso: Getnet usa las de
  // su configuración técnica. A CONFIRMAR si acepta URLs locales.
  const canReturn = returnUrl.startsWith("https://");
  const expiresAt = new Date(Date.now() + GETNET_INTENT_TTL_MS);

  try {
    const intent = await createPaymentIntent({
      orderReference: getnetOrderReference(orderNumber),
      total: Number(order.total),
      customer: { name: data.name, email: data.email, dni: billing.dni, phone: data.phone },
      billing: { street: billing.street, number: billing.number, postalCode: billing.postalCode },
      ...(canReturn ? { successUrl: returnUrl, errorUrl: returnUrl } : {}),
      expiresIn: GETNET_INTENT_EXPIRES,
    });

    const { error } = await supabase
      .from("orders")
      .update({
        payment_intent_id: intent.paymentIntentId,
        payment_redirect_url: intent.redirectUrl,
        payment_expires_at: expiresAt.toISOString(),
      })
      .eq("id", orderId);
    if (error) {
      // Sin el intent guardado, el webhook no encontraría el pedido: mejor
      // no mandar a pagar.
      console.error("[checkout] no se pudo guardar el intent", orderId, error.code);
      return { ok: false, error: GENERIC_ERROR };
    }
    return { ok: true, redirectUrl: intent.redirectUrl, orderUrl };
  } catch (e) {
    console.error("[checkout] getnet", e instanceof Error ? e.message : "error");
    return { ok: false, error: GENERIC_ERROR };
  }
}

// ---------------------------------------------------------------------------
// Mercado Pago (Checkout Pro) — apagado con PAYMENT_PROVIDER=getnet
// ---------------------------------------------------------------------------

async function startMercadoPagoPayment({
  supabase,
  orderId,
  orderNumber,
  orderUrl,
  returnUrl,
  notifyBase,
  data,
}: PaymentStart & { notifyBase: string }): Promise<CheckoutResult> {
  // ---- Lo guardado en el pedido (precios y envío "congelados") -----
  const [{ data: order }, { data: items }] = await Promise.all([
    supabase.from("orders").select("shipping_cost, discount_total, coupon_code, total").eq("id", orderId).single(),
    supabase
      .from("order_items")
      .select("id, product_name, variant_label, unit_price, quantity")
      .eq("order_id", orderId)
      .order("product_name"),
  ]);
  if (!order || !items?.length) {
    console.error("[checkout] no se pudo releer el pedido", orderId);
    return { ok: false, error: GENERIC_ERROR };
  }

  const notificationUrl = `${notifyBase}/api/mercadopago/webhook`;
  // MP rechaza URLs locales (localhost, 127.0.0.1) en back_urls. Solo se
  // mandan con https (producción, vista previa). En local (plan B), el
  // cliente vuelve con "Ver el estado de mi último pedido" en
  // /finalizar-compra (el link se guarda en el navegador antes de ir a MP).
  const canReturn = returnUrl.startsWith("https://");
  // Mismo criterio para el aviso: sin https (local sin túnel) no se manda, y
  // el pago igual avisa a la URL configurada en el panel de Webhooks de MP.
  const canNotify = notificationUrl.startsWith("https://");
  if (!canNotify) {
    console.warn("[checkout] notification_url omitida (no es https): se usa la URL configurada en el panel de MP.");
  }
  let testMode: boolean;
  try {
    testMode = await isTestCredentials();
  } catch (e) {
    // Ej.: falta MERCADOPAGO_ACCESS_TOKEN (el mensaje dice cuál).
    console.error("[checkout]", e instanceof Error ? e.message : e);
    return { ok: false, error: GENERIC_ERROR };
  }
  if (process.env.NODE_ENV !== "production") {
    console.info(`[checkout] Mercado Pago en modo ${testMode ? "PRUEBA (sin payer.email)" : "PRODUCCIÓN"}`);
  }
  const now = new Date();
  const expiresAt = new Date(now.getTime() + PREFERENCE_TTL_MS);

  // Con cupón: Mercado Pago no acepta precios negativos (no hay un ítem
  // "descuento"), así que va UN solo ítem por el total del pedido. Así lo
  // cobrado coincide exacto con orders.total, que es lo que controla el
  // webhook (apply_order_payment). Sin cupón, un ítem por producto + envío.
  const discount = Number(order.discount_total);
  const preferenceItems: PreferenceInput["items"] =
    discount > 0
      ? [
          {
            id: "pedido",
            title: `Compra en Home Deko · Pedido #${orderNumber}`,
            description: `Incluye el cupón ${order.coupon_code ?? ""}`.trim(),
            quantity: 1,
            unit_price: Number(order.total),
          },
        ]
      : [
          ...items.map((i) => ({
            id: i.id,
            title: (i.variant_label ? `${i.product_name} (${i.variant_label})` : i.product_name).slice(0, 250),
            quantity: i.quantity,
            unit_price: Number(i.unit_price),
          })),
          ...(Number(order.shipping_cost) > 0
            ? [{ id: "envio", title: "Envío a domicilio", quantity: 1, unit_price: Number(order.shipping_cost) }]
            : []),
        ];

  const preference: PreferenceInput = {
    items: preferenceItems,
    // Con credenciales de PRUEBA no se manda el email: si es el de una cuenta
    // real de MP, el pago falla con "Una de las partes con la que intentás
    // hacer el pago es de prueba". Sin email, el comprador de prueba se
    // identifica en Mercado Pago. En producción sí va (pre-completa el pago).
    // El email del cliente queda igual guardado en el pedido.
    payer: testMode ? { name: data.name } : { name: data.name, email: data.email },
    external_reference: orderId,
    ...(canReturn
      ? {
          back_urls: { success: returnUrl, pending: returnUrl, failure: returnUrl },
          // Al aprobarse, vuelve solo a la página del pedido.
          auto_return: "approved" as const,
        }
      : {}),
    ...(canNotify ? { notification_url: notificationUrl } : {}),
    statement_descriptor: "HOMEDEKO",
    expires: true,
    expiration_date_from: mpDate(now),
    expiration_date_to: mpDate(expiresAt),
    // Sin pagos en efectivo (Rapipago, Pago Fácil): quedan pendientes días
    // y agrandan el riesgo de vender dos veces la última unidad.
    payment_methods: { excluded_payment_types: [{ id: "ticket" }, { id: "atm" }] },
    metadata: { order_number: orderNumber },
  };

  try {
    // Clave de idempotencia = id del pedido: un reintento no crea dos preferencias.
    const pref = await createPreference(preference, orderId);
    await supabase
      .from("orders")
      .update({ mp_preference_id: pref.id, mp_expires_at: expiresAt.toISOString() })
      .eq("id", orderId);
    return { ok: true, redirectUrl: pref.init_point, orderUrl };
  } catch (e) {
    console.error("[checkout] preferencia", e);
    return { ok: false, error: GENERIC_ERROR };
  }
}

// ---------------------------------------------------------------------------
// "¿Tenés un cupón?" → Aplicar
// ---------------------------------------------------------------------------

const couponCheckSchema = z.object({
  code: couponCodeSchema,
  items: itemsSchema,
  delivery: z.enum(["shipping", "pickup"]).optional(),
  // Opcional: si todavía no lo escribió, "un uso por cliente" se controla al pagar.
  email: z.string().trim().max(254).optional(),
});

/**
 * Vista previa del cupón para el resumen del checkout. Usa la MISMA cuenta
 * que create_order (coupon_quote en la base): lo que se ve acá es lo que se
 * cobra. No guarda nada. Cada llamada cuenta para el límite de intentos.
 */
export async function checkCoupon(input: unknown): Promise<CouponCheckResult> {
  const parsed = couponCheckSchema.safeParse(input);
  if (!parsed.success || !parsed.data.code) {
    return { ok: false, error: "Revisá el código del cupón." };
  }
  const { code, items, delivery, email } = parsed.data;
  const supabase = createAdminClient();

  if (!(await allowCouponAttempt(supabase))) {
    return { ok: false, error: COUPON_RATE_LIMIT_MESSAGE };
  }

  const validEmail = email && z.email().safeParse(email).success ? email : null;
  const { data, error } = await supabase.rpc("coupon_quote", {
    p: {
      coupon_code: code,
      customer_email: validEmail,
      // Sin entrega elegida, se calcula como retiro (envío $ 0)
      delivery_method: delivery ?? "pickup",
      items: items.map((i) => ({ variant_id: i.variantId, qty: i.qty })),
    },
  });
  if (error || !data) {
    console.error("[cupones] coupon_quote", error?.message);
    return { ok: false, error: "No pudimos revisar el cupón. Probá de nuevo en unos minutos." };
  }

  const quote = data as CouponQuote;
  if (!quote.ok) {
    // Envío gratis sin la entrega elegida todavía: se acepta y se aplica al elegir envío.
    if (quote.error === "solo_envio" && !delivery) {
      return { ok: true, code, kind: "free_shipping", discount: 0 };
    }
    return { ok: false, error: couponErrorMessage(quote) };
  }
  return { ok: true, code: quote.code, kind: quote.kind, discount: Number(quote.discount) };
}

/** El detalle del error 'cupon' de create_order es el jsonb de coupon_quote. */
function parseQuoteError(details: string | null | undefined): CouponQuoteError {
  try {
    const q = JSON.parse(details ?? "") as CouponQuote;
    if (q && q.ok === false) return q;
  } catch {
    // sigue abajo
  }
  return { ok: false, error: "no_existe" };
}

/**
 * Guarda en el perfil los datos usados en la compra. La dirección, solo si
 * eligió envío (un retiro en el local no borra la dirección guardada).
 * El DNI y la facturación NO se guardan en el perfil.
 * Va con la clave secreta pero SIEMPRE filtrado por el id de la sesión.
 */
async function saveCheckoutToAccount(supabase: AdminClient, userId: string, data: CheckoutData) {
  const shipping =
    data.delivery === "shipping"
      ? {
          ship_address: data.address || null,
          ship_apartment: data.apartment || null,
          ship_city: data.city || null,
          ship_province: data.province || null,
          ship_postal_code: data.postalCode ? data.postalCode.toUpperCase() : null,
          ship_notes: data.notes || null,
        }
      : {};
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: data.name, phone: data.phone, ...shipping })
    .eq("id", userId);
  if (error) console.error("[checkout] no se pudieron guardar los datos en la cuenta:", error.message);
}
