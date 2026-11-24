"use server";

import type { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { checkoutSchema, fieldErrorsFrom, type CheckoutResult } from "@/lib/checkout-schema";
import { createPreference, isTestCredentials, mpDate, type PreferenceInput } from "@/lib/mercadopago";
import { createOrderToken, orderPath } from "@/lib/order-token";
import { notificationBaseUrl, siteUrl } from "@/lib/site-url";
import { createAdminClient } from "@/lib/supabase/admin";

/** La preferencia (link de pago) vence a las 2 horas: nadie paga después un precio viejo. */
const PREFERENCE_TTL_MS = 2 * 60 * 60 * 1000;

const GENERIC_ERROR = "No pudimos iniciar el pago. Probá de nuevo en unos minutos o escribinos por WhatsApp.";

type CheckoutData = z.output<typeof checkoutSchema>;

/**
 * "Pagar con Mercado Pago".
 *
 * 1. Valida los datos (zod).
 * 2. create_order (en la base): precios de store_variants, envío de
 *    Configuración, verifica stock. El total lo calcula la base.
 * 3. Arma la preferencia de Mercado Pago con lo GUARDADO en el pedido.
 * 4. Devuelve el link de pago; el navegador redirige.
 *
 * El pago NO se confirma acá ni al volver de Mercado Pago: solo el webhook
 * (src/app/api/mercadopago/webhook/route.ts) lo confirma y descuenta stock.
 */
export async function startCheckout(input: unknown): Promise<CheckoutResult> {
  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Revisá los datos marcados.", fieldErrors: fieldErrorsFrom(parsed.error) };
  }
  const data = parsed.data;

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
    },
  });

  if (error || !created?.[0]) {
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
    console.error("[checkout] create_order", error);
    return { ok: false, error: GENERIC_ERROR };
  }

  const { order_id: orderId, order_number: orderNumber } = created[0];

  // Con sesión y "Guardar estos datos en mi cuenta": actualiza "Mis datos".
  // Si falla, la compra sigue igual (no es parte del pago).
  if (user && data.saveToAccount) await saveCheckoutToAccount(supabase, user.id, data);

  // ---- 2. Lo guardado en el pedido (precios y envío "congelados") -----
  const [{ data: order }, { data: items }] = await Promise.all([
    supabase.from("orders").select("shipping_cost, total").eq("id", orderId).single(),
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

  // ---- 3. Preferencia de Mercado Pago ---------------------------------
  const returnUrl = `${base}${orderPath(orderId, token)}`;
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

  const preference: PreferenceInput = {
    items: [
      ...items.map((i) => ({
        id: i.id,
        title: (i.variant_label ? `${i.product_name} (${i.variant_label})` : i.product_name).slice(0, 250),
        quantity: i.quantity,
        unit_price: Number(i.unit_price),
      })),
      ...(Number(order.shipping_cost) > 0
        ? [{ id: "envio", title: "Envío a domicilio", quantity: 1, unit_price: Number(order.shipping_cost) }]
        : []),
    ],
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
    return { ok: true, redirectUrl: pref.init_point, orderUrl: orderPath(orderId, token) };
  } catch (e) {
    console.error("[checkout] preferencia", e);
    return { ok: false, error: GENERIC_ERROR };
  }
}

/**
 * Guarda en el perfil los datos usados en la compra. La dirección, solo si
 * eligió envío (un retiro en el local no borra la dirección guardada).
 * Va con la clave secreta pero SIEMPRE filtrado por el id de la sesión.
 */
async function saveCheckoutToAccount(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
  data: CheckoutData,
) {
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
