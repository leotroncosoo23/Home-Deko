import "server-only";
import { trackingFor } from "@/lib/carriers";
import { titleCase } from "@/lib/format";
import { customerOrderUrl } from "@/lib/order-token";
import { siteUrl } from "@/lib/site-url";
import { getStoreSettings, ownersEmail, whatsappLink } from "@/lib/store-settings";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, type EmailMessage } from "./send";
import {
  newOrderOwnersEmail,
  paymentConfirmedEmail,
  readyForPickupEmail,
  reviewOwnersEmail,
  shippedEmail,
  type EmailLinks,
  type EmailOrder,
  type RenderedEmail,
} from "./templates";

/**
 * Mails de un pedido según lo que pasó:
 *   "approved" → al cliente "Pago confirmado" + a los dueños "Pedido nuevo"
 *   "review"   → a los dueños "Pedido para revisar"
 *   "shipped"  → al cliente "Enviado" (con el seguimiento)
 *   "ready"    → al cliente "Listo para retirar"
 *
 * Se llama con after() (después de responder), así un mail lento nunca
 * demora el webhook ni un botón del panel. NUNCA tira error: cualquier
 * problema queda en la consola y en la línea de tiempo del pedido.
 *
 * Lee con la clave secreta: corre sin la sesión del usuario (webhook).
 */
export type OrderEmailEvent = "approved" | "review" | "shipped" | "ready";

export async function sendOrderEmails(orderId: string, event: OrderEmailEvent): Promise<void> {
  try {
    const supabase = createAdminClient();
    const [{ data: row }, { data: items }, settings] = await Promise.all([
      supabase
        .from("orders")
        .select(
          "id, order_number, customer_name, customer_email, customer_phone, delivery_method, ship_address, ship_apartment, ship_city, ship_province, ship_postal_code, ship_notes, pickup_address, pickup_hours, subtotal, shipping_cost, discount_total, total, stock_issue, review_reason, carrier, carrier_name, tracking_code, tracking_url",
        )
        .eq("id", orderId)
        .maybeSingle(),
      supabase
        .from("order_items")
        .select("product_name, variant_label, quantity, line_total")
        .eq("order_id", orderId)
        .order("product_name"),
      getStoreSettings(),
    ]);
    if (!row) {
      console.warn("[email] pedido inexistente", orderId);
      return;
    }

    const order: EmailOrder = {
      id: row.id,
      number: row.order_number,
      // Mayúscula inicial solo para mostrar (lo guardado no cambia)
      customerName: titleCase(row.customer_name),
      customerEmail: row.customer_email,
      customerPhone: row.customer_phone,
      pickup: row.delivery_method === "pickup",
      shipTo:
        row.delivery_method === "shipping"
          ? `${row.ship_address}, ${titleCase(row.ship_city)}, ${titleCase(row.ship_province)} (CP ${row.ship_postal_code})`
          : null,
      shipApartment: row.ship_apartment,
      shipNotes: row.ship_notes,
      pickupAddress: row.pickup_address,
      pickupHours: row.pickup_hours,
      items: (items ?? []).map((i) => ({
        name: i.product_name,
        variant: i.variant_label,
        quantity: i.quantity,
        lineTotal: Number(i.line_total),
      })),
      subtotal: Number(row.subtotal),
      shippingCost: Number(row.shipping_cost),
      discount: Number(row.discount_total),
      total: Number(row.total),
      stockIssue: row.stock_issue,
      reviewReason: row.review_reason,
      tracking: trackingFor(row),
    };

    const base = siteUrl();
    const links: EmailLinks = {
      logoUrl: base ? `${base}/brand/logo-horizontal-sin-frase-negro.png` : null,
      siteUrl: base,
      orderUrl: customerOrderUrl(order.id),
      panelUrl: base ? `${base}/admin/pedidos/${order.id}` : null,
      whatsappUrl: whatsappLink(settings, `Hola Home Deko, te escribo por mi pedido #${order.number}.`),
    };
    const owners = ownersEmail(settings);
    const replyTo = owners;

    const toCustomer = (label: string, mail: RenderedEmail, key: string) =>
      deliver(orderId, `Mail al cliente: ${label}`, {
        to: order.customerEmail,
        ...mail,
        replyTo,
        idempotencyKey: `pedido-${orderId}-${key}`,
      });

    const toOwners = async (label: string, mail: RenderedEmail, key: string) => {
      if (!owners) {
        console.warn(`[email] sin email del negocio en Configuración: no se avisó el pedido #${order.number}.`);
        await logEvent(orderId, false, `Aviso a los dueños no enviado (${label}): falta el email del negocio en Configuración.`);
        return;
      }
      await deliver(orderId, `Aviso a los dueños: ${label}`, {
        to: owners,
        ...mail,
        idempotencyKey: `pedido-${orderId}-${key}`,
      });
    };

    switch (event) {
      case "approved":
        await Promise.all([
          toCustomer("Pago confirmado", paymentConfirmedEmail(order, links), "pago"),
          toOwners("Pedido nuevo", newOrderOwnersEmail(order, links), "nuevo"),
        ]);
        break;
      case "review":
        await toOwners("Pedido para revisar", reviewOwnersEmail(order, links), "revisar");
        break;
      case "shipped":
        // La clave incluye el código: si lo corrigen, el mail nuevo sí sale.
        await toCustomer("Enviado", shippedEmail(order, links), `enviado-${order.tracking?.code ?? ""}`);
        break;
      case "ready":
        await toCustomer("Listo para retirar", readyForPickupEmail(order, links), "listo");
        break;
    }
  } catch (e) {
    console.error("[email] error armando los mails del pedido", orderId, e instanceof Error ? e.message : e);
  }
}

async function deliver(orderId: string, label: string, message: EmailMessage): Promise<void> {
  const result = await sendEmail(message);
  if (result.ok) {
    await logEvent(orderId, true, `${label} (${message.to})`);
  } else {
    await logEvent(
      orderId,
      false,
      result.skipped ? `${label}: no se envió porque falta configurar el servicio de mails.` : `${label}: no se pudo enviar.`,
    );
  }
}

/** Anota el mail en la línea de tiempo del pedido (si falla, solo consola). */
async function logEvent(orderId: string, ok: boolean, note: string): Promise<void> {
  const { error } = await createAdminClient()
    .from("order_events")
    .insert({ order_id: orderId, kind: ok ? "email_sent" : "email_failed", note: note.slice(0, 500) });
  if (error) console.error("[email] no se pudo anotar en la línea de tiempo", error.message);
}
