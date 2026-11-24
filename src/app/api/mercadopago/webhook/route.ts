import { after, type NextRequest } from "next/server";
import { revalidateTag } from "next/cache";
import { sendOrderEmails } from "@/lib/email/order-emails";
import { getPayment, MercadoPagoError, verifyWebhookSignature } from "@/lib/mercadopago";
import { STORE_PRODUCTS_TAG } from "@/lib/store-cache";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/mercadopago/webhook — avisos de pago de Mercado Pago.
 *
 * Es lo ÚNICO que confirma un pago:
 *   1. Verifica la firma (x-signature) con MERCADOPAGO_WEBHOOK_SECRET.
 *   2. NO cree lo que dice el aviso: consulta el pago a la API de MP.
 *   3. apply_order_payment (en la base) actualiza el pedido y, si se aprobó,
 *      descuenta stock UNA sola vez (si el aviso llega dos veces, no pasa nada).
 *   4. Si cambió el stock, refresca la caché del catálogo.
 *   5. Manda los mails (pago confirmado / pedido nuevo / para revisar).
 *
 * Respuestas: 200 = recibido (MP no reintenta) · 401 = firma inválida ·
 * 500 = error pasajero (MP reintenta más tarde).
 *
 * Formatos:
 *   - Webhooks (el que usamos): ?data.id=123&type=payment + cuerpo JSON.
 *   - IPN viejo (?topic=payment&id=123, sin firma): se responde 200 y se
 *     ignora. En el panel de MP se activa solo "Webhooks".
 *
 * El modo construcción no lo bloquea: /api/mercadopago está en
 * src/lib/public-routes.ts.
 */
export async function POST(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const body = (await request.json().catch(() => null)) as {
    type?: unknown;
    action?: unknown;
    data?: { id?: unknown };
  } | null;

  // ---- IPN viejo: no se procesa (no trae firma) -------------------------
  if (params.has("topic") && !params.has("type")) {
    console.info("[mp-webhook] aviso IPN ignorado", params.get("topic"));
    return new Response(null, { status: 200 });
  }

  const type = params.get("type") ?? (typeof body?.type === "string" ? body.type : null);
  const dataId =
    params.get("data.id") ??
    (typeof body?.data?.id === "string" || typeof body?.data?.id === "number" ? String(body.data.id) : null);

  // ---- Firma -------------------------------------------------------------
  let signed: boolean;
  try {
    signed = verifyWebhookSignature({
      xSignature: request.headers.get("x-signature"),
      xRequestId: request.headers.get("x-request-id"),
      dataId,
    });
  } catch (e) {
    // Falta MERCADOPAGO_WEBHOOK_SECRET: 500 para que MP reintente cuando esté.
    console.error("[mp-webhook]", e instanceof Error ? e.message : e);
    return new Response(null, { status: 500 });
  }
  if (!signed) {
    console.warn("[mp-webhook] firma inválida", { type, dataId });
    return new Response(null, { status: 401 });
  }

  // Otros temas (órdenes, contracargos, etc.): recibidos, sin hacer nada.
  if (type !== "payment" || !dataId) return new Response(null, { status: 200 });

  try {
    // ---- El pago, tal como lo tiene Mercado Pago -------------------------
    const payment = await getPayment(dataId);
    if (!payment) {
      // Ej.: "Simular notificación" del panel de MP, con un id inventado.
      console.info("[mp-webhook] pago inexistente", dataId);
      return new Response(null, { status: 200 });
    }
    const orderId = payment.external_reference;
    if (!orderId || !/^[0-9a-f-]{36}$/i.test(orderId)) {
      console.warn("[mp-webhook] pago sin pedido", payment.id);
      return new Response(null, { status: 200 });
    }

    // ---- Pedido (idempotente, en la base) --------------------------------
    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc("apply_order_payment", {
      p_order_id: orderId,
      p_payment_id: payment.id,
      p_status: payment.status,
      p_status_detail: payment.status_detail ?? "",
      p_amount: payment.transaction_amount,
      p_currency: payment.currency_id,
    });
    if (error) {
      console.error("[mp-webhook] apply_order_payment", error);
      return new Response(null, { status: 500 });
    }

    const result = data?.[0];
    console.info("[mp-webhook]", { orderId, payment: payment.id, status: payment.status, result: result?.result });

    // Bajó el stock: la tienda tiene que mostrarlo ya ("¡Últimas unidades!",
    // sin stock). En un Route Handler no existe updateTag: esto es su
    // equivalente (vence la caché en el acto).
    if (result?.stock_changed) revalidateTag(STORE_PRODUCTS_TAG, { expire: 0 });

    // Mails, DESPUÉS de responder (Mercado Pago no espera). apply_order_payment
    // devuelve "approved" una sola vez por pedido: no hay mails repetidos.
    if (result?.result === "approved") after(() => sendOrderEmails(orderId, "approved"));
    if (result?.result === "review") after(() => sendOrderEmails(orderId, "review"));

    return new Response(null, { status: 200 });
  } catch (e) {
    console.error("[mp-webhook] error", e);
    const transient = !(e instanceof MercadoPagoError) || e.transient;
    return new Response(null, { status: transient ? 500 : 200 });
  }
}
