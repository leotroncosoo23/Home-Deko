import { after, type NextRequest } from "next/server";
import { revalidateTag } from "next/cache";
import { sendOrderEmails } from "@/lib/email/order-emails";
import { getnetConfig } from "@/lib/payments/config";
import { fromCents, getnetOrderReference, normalizeStatus, parseWebhook, verifyBasicAuth } from "@/lib/payments/getnet";
import { STORE_PRODUCTS_TAG } from "@/lib/store-cache";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/getnet/webhook — aviso de pago de Getnet (Web Checkout).
 *
 * Getnet lo manda cuando el pago se autoriza o se rechaza, con
 * Authorization: Basic (usuario y contraseña cargados en su portal =
 * GETNET_WEBHOOK_USER / GETNET_WEBHOOK_PASSWORD).
 *
 *   1. Basic auth (comparación en tiempo constante). Mal → 401.
 *   2. Busca el pedido por payment_intent_id y controla la referencia
 *      (order_id = "HD-<número>"). Si no coincide, NO se aprueba: queda
 *      "Para revisar" (p_mismatch).
 *   3. apply_order_payment (en la base): controla monto exacto y moneda
 *      ARS, y si se aprobó descuenta stock UNA sola vez. Un aviso repetido
 *      no descuenta ni manda mails de nuevo (devuelve already_processed).
 *      Un "rechazado" no cierra el pedido: si después llega "aprobado"
 *      (el cliente probó otra tarjeta), se aprueba normal.
 *   4. Si cambió el stock, refresca la caché del catálogo.
 *   5. Mails (pago confirmado / pedido nuevo / para revisar).
 *
 * Respuestas: 200 = recibido (Getnet no reintenta) · 401 = credenciales
 * inválidas · 500/503 = error pasajero o sin configurar (Getnet reintenta:
 * 5 veces y después una vez por hora durante 72 h).
 *
 * Logs: nunca nombre, email, DNI ni dirección del cliente; tampoco el header.
 * El modo construcción no lo bloquea: /api/getnet está en src/lib/public-routes.ts.
 */
export async function POST(request: NextRequest) {
  const config = getnetConfig();
  if (!config) {
    // Para Leo: faltan variables GETNET_*. 503 → Getnet reintenta más tarde.
    console.error("[getnet-webhook] Getnet sin configurar");
    return new Response(null, { status: 503 });
  }
  if (!verifyBasicAuth(request.headers.get("authorization"), config.webhookUser, config.webhookPassword)) {
    console.warn("[getnet-webhook] credenciales inválidas");
    return new Response(null, { status: 401 });
  }

  const hook = parseWebhook(await request.json().catch(() => null));
  if (!hook) {
    // Reintentar no lo arregla: se responde 200 y queda en el log.
    console.warn("[getnet-webhook] aviso con formato inesperado");
    return new Response(null, { status: 200 });
  }

  const intentId = hook.payment_intent_id;
  const rawStatus = hook.payment.result.status;
  const status = normalizeStatus(rawStatus);
  if (!status) {
    console.info("[getnet-webhook] estado no reconocido", { intentId, status: rawStatus });
    return new Response(null, { status: 200 });
  }

  try {
    const supabase = createAdminClient();
    const { data: order, error: findError } = await supabase
      .from("orders")
      .select("id, order_number")
      .eq("payment_intent_id", intentId)
      .maybeSingle();
    if (findError) {
      console.error("[getnet-webhook] buscar pedido", findError.code);
      return new Response(null, { status: 500 });
    }
    if (!order) {
      console.warn("[getnet-webhook] intent sin pedido", { intentId });
      return new Response(null, { status: 200 });
    }

    // La referencia tiene que ser la de ESTE pedido. Si falta o no coincide,
    // no se aprueba (queda para revisión manual).
    const expectedRef = getnetOrderReference(order.order_number);
    const mismatch = hook.order_id !== expectedRef;
    if (mismatch) {
      console.warn("[getnet-webhook] la referencia no coincide", { order: order.order_number, intentId });
    }

    const detail = [rawStatus, hook.payment.result.return_message].filter(Boolean).join(" — ").slice(0, 300);
    const { data, error } = await supabase.rpc("apply_order_payment", {
      p_order_id: order.id,
      // Si Getnet no manda payment_id, va vacío (el pedido igual se identifica por el intent).
      p_payment_id: hook.payment.result.payment_id ?? "",
      p_status: status,
      p_status_detail: detail,
      p_amount: fromCents(hook.payment.amount),
      p_currency: hook.payment.currency,
      p_provider: "getnet",
      p_mismatch: mismatch,
    });
    if (error) {
      console.error("[getnet-webhook] apply_order_payment", error.code, error.message);
      return new Response(null, { status: 500 });
    }

    const result = data?.[0];
    console.info("[getnet-webhook]", { order: order.order_number, intentId, status: rawStatus, result: result?.result });

    if (result?.stock_changed) revalidateTag(STORE_PRODUCTS_TAG, { expire: 0 });

    // Mails DESPUÉS de responder. apply_order_payment devuelve "approved"
    // una sola vez por pedido: no hay mails repetidos.
    const orderId = order.id;
    if (result?.result === "approved") after(() => sendOrderEmails(orderId, "approved"));
    if (result?.result === "review") after(() => sendOrderEmails(orderId, "review"));

    return new Response(null, { status: 200 });
  } catch (e) {
    console.error("[getnet-webhook] error", e instanceof Error ? e.message : "desconocido");
    return new Response(null, { status: 500 });
  }
}
