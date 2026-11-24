"use server";

import { refresh, updateTag } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { CARRIERS } from "@/lib/carriers";
import { sendOrderEmails } from "@/lib/email/order-emails";
import { isEmailConfigured } from "@/lib/email/send";
import { STORE_PRODUCTS_TAG } from "@/lib/store-cache";
import { getStoreSettings, senderForLabel } from "@/lib/store-settings";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult, PrintData } from "./types";

/**
 * Server Actions de Pedidos. Todo cambio de estado lo hace la BASE
 * (funciones con is_admin() y las reglas de qué estado sigue a cuál):
 * acá solo se valida la forma de los datos, se llama a la función y se avisa.
 *
 * Los mails al cliente salen con after() (después de responder): un mail
 * lento nunca demora el botón.
 */

const GENERIC = "No se pudo completar. Revisá tu conexión e intentá de nuevo.";

/** Errores de la base → mensaje para los dueños (los HD4xx ya vienen escritos para ellos). */
function translate(error: { code?: string; message: string }): string {
  if (error.code?.startsWith("HD4")) return error.message;
  if (error.code === "42501") return "Tu cuenta no tiene permiso para cambiar pedidos.";
  console.error("[pedidos]", error.code, error.message);
  return GENERIC;
}

const id = z.uuid();

/** "Le mandamos al cliente …" solo si el servicio de mails está configurado. */
const mailNote = (what: string) => (isEmailConfigured() ? ` Le mandamos al cliente ${what}.` : "");

// ---------------------------------------------------------------------------
// "Preparando" (uno o varios)
// ---------------------------------------------------------------------------
export async function markOrdersPreparing(ids: string[]): Promise<ActionResult> {
  await requireAdmin();
  const parsed = z.array(id).min(1).max(200).safeParse(ids);
  if (!parsed.success) return { ok: false, error: "Elegí al menos un pedido." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("mark_orders_preparing", { p_ids: parsed.data });
  if (error) return { ok: false, error: translate(error) };
  refresh();

  const done = data.filter((r) => r.ok);
  const skipped = data.filter((r) => !r.ok);
  if (done.length === 0) {
    return {
      ok: false,
      error:
        skipped.length === 1
          ? `Pedido #${skipped[0].order_number}: ${skipped[0].reason}`
          : "Ninguno de los pedidos elegidos estaba «Para preparar».",
    };
  }
  const main = done.length === 1 ? `Pedido #${done[0].order_number}: Preparando.` : `${done.length} pedidos pasaron a Preparando.`;
  const extra =
    skipped.length > 0
      ? ` ${skipped.length === 1 ? `El #${skipped[0].order_number} no se cambió` : `${skipped.length} no se cambiaron`} (no estaban «Para preparar»).`
      : "";
  return { ok: true, message: main + extra };
}

// ---------------------------------------------------------------------------
// Avanzar el estado de un pedido
// ---------------------------------------------------------------------------
const simpleStatus = z.enum(["preparing", "delivered", "ready_for_pickup", "picked_up"]);

const SIMPLE_MESSAGES: Record<z.infer<typeof simpleStatus>, string> = {
  preparing: "El pedido pasó a Preparando.",
  delivered: "Listo: el pedido quedó como Entregado.",
  ready_for_pickup: "El pedido está Listo para retirar.",
  picked_up: "Listo: el pedido quedó como Retirado.",
};

export async function setOrderStatus(orderId: string, to: string): Promise<ActionResult> {
  await requireAdmin();
  const parsed = z.object({ orderId: id, to: simpleStatus }).safeParse({ orderId, to });
  if (!parsed.success) return { ok: false, error: "Datos inválidos." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_order_status", { p_order_id: parsed.data.orderId, p_to: parsed.data.to });
  if (error) return { ok: false, error: translate(error) };
  if (parsed.data.to === "ready_for_pickup") after(() => sendOrderEmails(parsed.data.orderId, "ready"));
  refresh();
  const note = parsed.data.to === "ready_for_pickup" ? mailNote("un mail para que lo pase a buscar") : "";
  return { ok: true, message: SIMPLE_MESSAGES[parsed.data.to] + note };
}

// ---------------------------------------------------------------------------
// Enviado (o corregir el seguimiento)
// ---------------------------------------------------------------------------
const shipSchema = z
  .object({
    orderId: id,
    carrier: z.enum(CARRIERS.map((c) => c.value) as [string, ...string[]]),
    carrierName: z.string().trim().max(60, "El nombre de la empresa puede tener hasta 60 caracteres."),
    trackingCode: z
      .string()
      .trim()
      .min(1, "Escribí el código de seguimiento.")
      .max(60, "El código puede tener hasta 60 caracteres."),
    trackingUrl: z
      .string()
      .trim()
      .max(500)
      .refine((v) => v === "" || /^https?:\/\//.test(v), "El link tiene que empezar con https://"),
  })
  .refine((v) => v.carrier !== "otra" || v.carrierName.length > 0, {
    message: "Escribí el nombre de la empresa de envío.",
    path: ["carrierName"],
  });

export async function shipOrder(input: unknown): Promise<ActionResult> {
  await requireAdmin();
  const parsed = shipSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  const v = parsed.data;

  const supabase = await createClient();
  const { data: before } = await supabase.from("orders").select("fulfillment_status").eq("id", v.orderId).maybeSingle();
  const { error } = await supabase.rpc("set_order_status", {
    p_order_id: v.orderId,
    p_to: "shipped",
    p_carrier: v.carrier as (typeof CARRIERS)[number]["value"],
    p_carrier_name: v.carrier === "otra" ? v.carrierName : undefined,
    p_tracking_code: v.trackingCode,
    p_tracking_url: v.carrier === "otra" && v.trackingUrl ? v.trackingUrl : undefined,
  });
  if (error) return { ok: false, error: translate(error) };

  after(() => sendOrderEmails(v.orderId, "shipped"));
  refresh();
  return {
    ok: true,
    message:
      before?.fulfillment_status === "shipped"
        ? `Seguimiento corregido.${mailNote("un mail con el código nuevo")}`
        : `Pedido enviado.${mailNote("un mail con el seguimiento")}`,
  };
}

// ---------------------------------------------------------------------------
// Cancelar
// ---------------------------------------------------------------------------
export async function cancelOrder(orderId: string, reason: string): Promise<ActionResult> {
  await requireAdmin();
  const parsed = z
    .object({ orderId: id, reason: z.string().trim().max(300, "El motivo puede tener hasta 300 caracteres.") })
    .safeParse({ orderId, reason });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };

  const supabase = await createClient();
  const { data: units, error } = await supabase.rpc("cancel_order", {
    p_order_id: parsed.data.orderId,
    p_reason: parsed.data.reason || undefined,
  });
  if (error) return { ok: false, error: translate(error) };
  if (units > 0) updateTag(STORE_PRODUCTS_TAG);
  refresh();
  return {
    ok: true,
    message:
      units > 0
        ? `Pedido cancelado. ${units === 1 ? "Volvió 1 unidad" : `Volvieron ${units} unidades`} al stock.`
        : "Pedido cancelado.",
  };
}

// ---------------------------------------------------------------------------
// Resolver "Pagado sin stock" y "Para revisar"
// ---------------------------------------------------------------------------
const noteSchema = z.string().trim().max(300, "La nota puede tener hasta 300 caracteres.");

export async function resolveStockIssue(orderId: string, mode: string, note: string): Promise<ActionResult> {
  await requireAdmin();
  const parsed = z
    .object({ orderId: id, mode: z.enum(["apply_stock", "manual"]), note: noteSchema })
    .safeParse({ orderId, mode, note });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };

  const supabase = await createClient();
  const { data: changed, error } = await supabase.rpc("resolve_stock_issue", {
    p_order_id: parsed.data.orderId,
    p_mode: parsed.data.mode,
    p_note: parsed.data.note || undefined,
  });
  if (error) return { ok: false, error: translate(error) };
  if (changed) updateTag(STORE_PRODUCTS_TAG);
  refresh();
  return {
    ok: true,
    message: changed ? "Listo: se descontó el stock y el pedido sigue «Para preparar»." : "Listo: aviso resuelto.",
  };
}

export async function resolveReview(orderId: string, mode: string, note: string): Promise<ActionResult> {
  await requireAdmin();
  const parsed = z
    .object({ orderId: id, mode: z.enum(["dismiss", "approve"]), note: noteSchema })
    .safeParse({ orderId, mode, note });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("resolve_review", { p_order_id: parsed.data.orderId, p_mode: parsed.data.mode, p_note: parsed.data.note || undefined })
    .single();
  if (error) return { ok: false, error: translate(error) };
  if (data?.stock_changed) updateTag(STORE_PRODUCTS_TAG);
  if (data?.approved) after(() => sendOrderEmails(parsed.data.orderId, "approved"));
  refresh();
  return {
    ok: true,
    message: data?.approved
      ? `Pago confirmado: el pedido quedó «Para preparar».${mailNote("el mail de confirmación")}`
      : "Listo: aviso resuelto.",
  };
}

// ---------------------------------------------------------------------------
// Datos para imprimir (rótulos y lista de preparación)
// ---------------------------------------------------------------------------
export async function getPrintData(ids: string[]): Promise<PrintData | { error: string }> {
  await requireAdmin();
  const parsed = z.array(id).min(1).max(200).safeParse(ids);
  if (!parsed.success) return { error: "Elegí al menos un pedido." };

  const supabase = await createClient();
  const [{ data, error }, settings] = await Promise.all([
    supabase
      .from("orders")
      .select(
        "id, order_number, customer_name, customer_phone, delivery_method, ship_address, ship_apartment, ship_city, ship_province, ship_postal_code, ship_notes, order_items(product_name, variant_label, quantity)",
      )
      .in("id", parsed.data)
      .order("order_number"),
    getStoreSettings(),
  ]);
  if (error) return { error: GENERIC };

  return {
    sender: senderForLabel(settings),
    orders: data.map((o) => ({
      id: o.id,
      number: o.order_number,
      customerName: o.customer_name,
      phone: o.customer_phone,
      pickup: o.delivery_method === "pickup",
      address: o.ship_address,
      apartment: o.ship_apartment,
      city: o.ship_city,
      province: o.ship_province,
      postalCode: o.ship_postal_code,
      notes: o.ship_notes,
      items: [...o.order_items]
        .sort((a, b) => a.product_name.localeCompare(b.product_name, "es"))
        .map((i) => ({ name: i.product_name, variant: i.variant_label, quantity: i.quantity })),
    })),
  };
}
