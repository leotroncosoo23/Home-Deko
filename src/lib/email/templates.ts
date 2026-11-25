import "server-only";
import type { Tracking } from "@/lib/carriers";
import { firstNameOf, formatARS } from "@/lib/format";

/**
 * Plantillas de los mails de pedidos.
 *
 * HTML "a la antigua" (tablas y estilos en línea): es lo único que se ve
 * igual en Gmail, Outlook y el celular. Cada mail trae además su versión de
 * texto plano (la usan algunos programas y ayuda a no caer en spam).
 *
 * Para cambiar un texto, editalo acá.
 */

export type EmailOrder = {
  id: string;
  number: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  pickup: boolean;
  /** "Calle 123, Ciudad, Provincia (CP 9200)" — null si es retiro. */
  shipTo: string | null;
  /** Piso / depto e indicaciones para la entrega (opcionales). */
  shipApartment: string | null;
  shipNotes: string | null;
  pickupAddress: string | null;
  pickupHours: string | null;
  items: { name: string; variant: string | null; quantity: number; lineTotal: number }[];
  subtotal: number;
  shippingCost: number;
  discount: number;
  /** Código del cupón (si se usó uno). */
  couponCode: string | null;
  total: number;
  stockIssue: boolean;
  reviewReason: string | null;
  tracking: Tracking | null;
  /** Plazo de despacho de Configuración ("24 a 48 h hábiles"), o null si no está cargado. */
  dispatchTime: string | null;
};

export type EmailLinks = {
  /** Logo por URL absoluta (null en local sin NEXT_PUBLIC_SITE_URL). */
  logoUrl: string | null;
  siteUrl: string | null;
  /** Página del pedido para el cliente (link secreto). */
  orderUrl: string | null;
  /** Detalle del pedido en el panel (para los dueños). */
  panelUrl: string | null;
  /** Chat de WhatsApp de la tienda (null si no está cargado). */
  whatsappUrl: string | null;
};

export type RenderedEmail = { subject: string; html: string; text: string };

// ---------------------------------------------------------------------------
// Piezas
// ---------------------------------------------------------------------------

const RED = "#C92728";
const INK = "#2B2B2B";
const MUTED = "#6B645E";
const BORDER = "#E7E1DB";
const FONT = "font-family:Helvetica,Arial,sans-serif;";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// El nombre ya llega con mayúscula inicial (order-emails.ts): esto se queda con el primero.
const firstName = (name: string) => firstNameOf(name);

function p(html: string): string {
  return `<p style="margin:0 0 14px;${FONT}font-size:15px;line-height:24px;color:${INK};">${html}</p>`;
}

function button(href: string, label: string, color = RED): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 18px;"><tr><td style="background:${color};border-radius:999px;">
<a href="${esc(href)}" style="display:inline-block;padding:12px 24px;${FONT}font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;">${esc(label)}</a>
</td></tr></table>`;
}

function box(title: string, inner: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 18px;border:1px solid ${BORDER};border-radius:12px;">
<tr><td style="padding:14px 16px;">
<p style="margin:0 0 8px;${FONT}font-size:12px;font-weight:bold;letter-spacing:.06em;text-transform:uppercase;color:${MUTED};">${esc(title)}</p>
${inner}
</td></tr></table>`;
}

function line(html: string, muted = false): string {
  return `<p style="margin:0 0 4px;${FONT}font-size:14px;line-height:21px;color:${muted ? MUTED : INK};">${html}</p>`;
}

/** "Cupón BIENVENIDA" (o "Descuento" si no hay código). */
function discountLabel(o: EmailOrder): string {
  return o.couponCode ? `Cupón ${o.couponCode}` : "Descuento";
}

function itemsTable(o: EmailOrder): string {
  const rows = o.items
    .map(
      (i) => `<tr>
<td style="padding:8px 0;border-bottom:1px solid ${BORDER};${FONT}font-size:14px;line-height:20px;color:${INK};">
${esc(i.name)}${i.variant ? `<br><span style="color:${MUTED};">${esc(i.variant)}</span>` : ""}
</td>
<td style="padding:8px 8px;border-bottom:1px solid ${BORDER};${FONT}font-size:14px;color:${MUTED};white-space:nowrap;" align="center">× ${i.quantity}</td>
<td style="padding:8px 0;border-bottom:1px solid ${BORDER};${FONT}font-size:14px;color:${INK};white-space:nowrap;" align="right">${esc(formatARS(i.lineTotal))}</td>
</tr>`,
    )
    .join("");
  const total = (label: string, value: string, bold = false) => `<tr>
<td colspan="2" style="padding:6px 0 0;${FONT}font-size:14px;color:${bold ? INK : MUTED};${bold ? "font-weight:bold;" : ""}">${esc(label)}</td>
<td style="padding:6px 0 0;${FONT}font-size:14px;color:${INK};white-space:nowrap;${bold ? "font-weight:bold;" : ""}" align="right">${esc(value)}</td>
</tr>`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;">
${rows}
${total("Subtotal", formatARS(o.subtotal))}
${o.discount > 0 ? total(discountLabel(o), `− ${formatARS(o.discount)}`) : ""}
${total(o.pickup ? "Retiro en el local" : "Envío a domicilio", o.pickup ? "Gratis" : formatARS(o.shippingCost))}
${total("Total", formatARS(o.total), true)}
</table>`;
}

function deliveryBox(o: EmailOrder): string {
  if (o.pickup) {
    return box(
      "Retiro en el local",
      (o.pickupAddress ? line(esc(o.pickupAddress)) : "") + (o.pickupHours ? line(esc(o.pickupHours), true) : ""),
    );
  }
  return box(
    "Envío a domicilio",
    line(esc(o.shipTo ?? "")) +
      (o.shipApartment ? line(`Piso / Depto: ${esc(o.shipApartment)}`) : "") +
      (o.shipNotes ? line(`Indicaciones: ${esc(o.shipNotes)}`, true) : "") +
      line(`A nombre de ${esc(o.customerName)}`, true),
  );
}

function trackingBox(t: Tracking): string {
  return box(
    "Seguimiento",
    line(`Empresa: <strong>${esc(t.carrierLabel)}</strong>`) +
      line(`Código: <strong style="font-size:16px;letter-spacing:.04em;">${esc(t.code)}</strong>`) +
      (t.url && !t.urlHasCode ? line("En la página de seguimiento, pegá este código.", true) : ""),
  );
}

/** Marco común: logo, contenido y pie. */
function layout(links: EmailLinks, preheader: string, body: string): string {
  const logo = links.logoUrl
    ? `<img src="${esc(links.logoUrl)}" width="200" height="36" alt="Home Deko" style="display:block;border:0;height:auto;max-width:200px;">`
    : `<span style="${FONT}font-size:24px;font-weight:bold;color:${INK};">Home <span style="color:${RED};">&#9829;</span> Deko</span>`;
  const footerLinks = [
    links.siteUrl ? `<a href="${esc(links.siteUrl)}" style="color:${MUTED};">homedekotrevelin.com</a>` : "",
    links.whatsappUrl ? `<a href="${esc(links.whatsappUrl)}" style="color:${MUTED};">WhatsApp</a>` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Home Deko</title></head>
<body style="margin:0;padding:0;background:#F4F1EE;">
<div style="display:none;max-height:0;overflow:hidden;">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F1EE;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;">
<tr><td style="padding:28px 28px 8px;border-top:4px solid ${RED};border-radius:16px 16px 0 0;">${logo}</td></tr>
<tr><td style="padding:16px 28px 12px;">${body}</td></tr>
</table>
<p style="margin:16px 0 0;${FONT}font-size:12px;line-height:18px;color:${MUTED};">Home Deko — Artículos del hogar${footerLinks ? `<br>${footerLinks}` : ""}</p>
</td></tr></table>
</body></html>`;
}

function heading(text: string): string {
  return `<h1 style="margin:0 0 14px;${FONT}font-size:22px;line-height:28px;color:${INK};">${esc(text)}</h1>`;
}

function textItems(o: EmailOrder): string {
  return [
    ...o.items.map((i) => `- ${i.name}${i.variant ? ` (${i.variant})` : ""} × ${i.quantity}: ${formatARS(i.lineTotal)}`),
    ...(o.discount > 0 ? [`${discountLabel(o)}: − ${formatARS(o.discount)}`] : []),
    `Total: ${formatARS(o.total)}`,
  ].join("\n");
}

function textDelivery(o: EmailOrder): string {
  return o.pickup
    ? `Retiro en el local: ${[o.pickupAddress, o.pickupHours].filter(Boolean).join(" — ")}`
    : [
        `Envío a: ${o.shipTo ?? ""}`,
        o.shipApartment ? `Piso / Depto: ${o.shipApartment}` : "",
        o.shipNotes ? `Indicaciones: ${o.shipNotes}` : "",
      ]
        .filter(Boolean)
        .join("\n");
}

const contactLine = (links: EmailLinks) =>
  links.whatsappUrl
    ? `¿Dudas? Respondé este mail o <a href="${esc(links.whatsappUrl)}" style="color:${RED};">escribinos por WhatsApp</a>.`
    : "¿Dudas? Respondé este mail y te contestamos.";

// ---------------------------------------------------------------------------
// Al CLIENTE
// ---------------------------------------------------------------------------

export function paymentConfirmedEmail(o: EmailOrder, links: EmailLinks): RenderedEmail {
  const subject = `¡Gracias por tu compra! Pedido #${o.number}`;
  const intro = o.stockIssue
    ? "Recibimos tu pago. Hubo un inconveniente con la disponibilidad de un producto: vamos a comunicarnos con vos muy pronto para resolverlo, ya sea con otro producto o devolviéndote el dinero."
    : o.pickup
      ? "Recibimos tu pago. Vamos a preparar tu pedido y te avisamos cuando esté listo para retirar."
      : o.dispatchTime
        ? `Recibimos tu pago. Despachamos tu pedido en ${o.dispatchTime} y te avisamos por mail con el código de seguimiento.`
        : "Recibimos tu pago. Vamos a preparar tu pedido y te avisamos cuando lo despachemos, con el código de seguimiento.";

  const html = layout(
    links,
    intro,
    heading(`¡Gracias, ${firstName(o.customerName)}!`) +
      p(`Tu pedido <strong>#${o.number}</strong> está confirmado.`) +
      p(esc(intro)) +
      (links.orderUrl ? button(links.orderUrl, "Ver mi pedido") : "") +
      itemsTable(o) +
      deliveryBox(o) +
      p(contactLine(links)),
  );
  const text = [
    `¡Gracias, ${firstName(o.customerName)}!`,
    `Tu pedido #${o.number} está confirmado.`,
    intro,
    links.orderUrl ? `Ver mi pedido: ${links.orderUrl}` : "",
    textItems(o),
    textDelivery(o),
  ]
    .filter(Boolean)
    .join("\n\n");
  return { subject, html, text };
}

export function shippedEmail(o: EmailOrder, links: EmailLinks): RenderedEmail {
  const t = o.tracking;
  const subject = `Tu pedido #${o.number} ya está en camino`;
  const html = layout(
    links,
    t ? `Lo enviamos por ${t.carrierLabel}. Código: ${t.code}` : "Tu pedido ya está en camino.",
    heading("¡Tu pedido ya está en camino!") +
      p(`Hola ${esc(firstName(o.customerName))}, despachamos tu pedido <strong>#${o.number}</strong>.`) +
      (t ? trackingBox(t) : "") +
      (t?.url ? button(t.url, "Seguir mi envío") : "") +
      deliveryBox(o) +
      (links.orderUrl ? p(`También podés ver el estado en <a href="${esc(links.orderUrl)}" style="color:${RED};">tu pedido</a>.`) : "") +
      p(contactLine(links)),
  );
  const text = [
    `Hola ${firstName(o.customerName)}, despachamos tu pedido #${o.number}.`,
    t ? `Empresa: ${t.carrierLabel}\nCódigo de seguimiento: ${t.code}${t.url ? `\nSeguilo acá: ${t.url}` : ""}` : "",
    textDelivery(o),
    links.orderUrl ? `Tu pedido: ${links.orderUrl}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
  return { subject, html, text };
}

export function readyForPickupEmail(o: EmailOrder, links: EmailLinks): RenderedEmail {
  const subject = `Tu pedido #${o.number} está listo para retirar`;
  const html = layout(
    links,
    "Ya podés pasar a buscarlo por el local.",
    heading("¡Tu pedido está listo!") +
      p(`Hola ${esc(firstName(o.customerName))}, ya podés pasar a retirar tu pedido <strong>#${o.number}</strong>.`) +
      deliveryBox(o) +
      p("Al retirarlo, decinos tu nombre o el número de pedido.") +
      (links.orderUrl ? button(links.orderUrl, "Ver mi pedido") : "") +
      p(contactLine(links)),
  );
  const text = [
    `Hola ${firstName(o.customerName)}, ya podés pasar a retirar tu pedido #${o.number}.`,
    textDelivery(o),
    "Al retirarlo, decinos tu nombre o el número de pedido.",
    links.orderUrl ? `Tu pedido: ${links.orderUrl}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
  return { subject, html, text };
}

// ---------------------------------------------------------------------------
// A los DUEÑOS
// ---------------------------------------------------------------------------

export function newOrderOwnersEmail(o: EmailOrder, links: EmailLinks): RenderedEmail {
  const subject = `${o.stockIssue ? "⚠ Pagado sin stock — " : ""}Pedido nuevo #${o.number} · ${formatARS(o.total)}`;
  const warning = o.stockIssue
    ? p(
        `<strong style="color:${RED};">Pagado sin stock:</strong> cuando llegó el pago ya no alcanzaba el stock. Entrá al pedido para resolverlo.`,
      )
    : "";
  const html = layout(
    links,
    `${o.customerName} · ${o.pickup ? "Retiro en el local" : "Envío a domicilio"} · ${formatARS(o.total)}`,
    heading(`Pedido nuevo #${o.number}`) +
      warning +
      box(
        "Cliente",
        line(`<strong>${esc(o.customerName)}</strong>`) + line(esc(o.customerEmail), true) + line(esc(o.customerPhone), true),
      ) +
      itemsTable(o) +
      deliveryBox(o) +
      (links.panelUrl ? button(links.panelUrl, "Ver en el panel", INK) : ""),
  );
  const text = [
    `Pedido nuevo #${o.number}`,
    o.stockIssue ? "ATENCIÓN: pagado sin stock. Entrá al pedido para resolverlo." : "",
    `Cliente: ${o.customerName} — ${o.customerEmail} — ${o.customerPhone}`,
    textItems(o),
    textDelivery(o),
    links.panelUrl ? `Ver en el panel: ${links.panelUrl}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
  return { subject, html, text };
}

// ---------------------------------------------------------------------------
// BOTÓN DE ARREPENTIMIENTO (Disposición 954/2025: el cliente recibe el código
// de su solicitud por el mismo medio; acá, en pantalla y por mail).
// ---------------------------------------------------------------------------

export type EmailWithdrawal = {
  id: string;
  /** ARR-XXXXXX */
  code: string;
  fullName: string;
  email: string;
  orderNumber: number | null;
  /** El número y el email coinciden con un pedido real. */
  orderMatched: boolean;
  reason: string | null;
  /** "24/11/2026, 18:30" (hora de Argentina). */
  receivedAt: string;
};

export function withdrawalReceivedEmail(w: EmailWithdrawal, links: EmailLinks): RenderedEmail {
  const subject = `Recibimos tu solicitud de arrepentimiento · ${w.code}`;
  const details =
    line(`Código: <strong style="font-size:16px;letter-spacing:.04em;">${esc(w.code)}</strong>`) +
    line(`Recibida: ${esc(w.receivedAt)}`, true) +
    (w.orderNumber ? line(`Pedido: #${w.orderNumber}`, true) : "");
  const html = layout(
    links,
    `Tu código de solicitud es ${w.code}.`,
    heading("Recibimos tu solicitud") +
      p(
        `Hola ${esc(firstName(w.fullName))}, registramos tu solicitud para arrepentirte de una compra. Guardá este código: identifica tu pedido de arrepentimiento.`,
      ) +
      box("Tu solicitud", details) +
      p(
        "En breve te escribimos para coordinar la devolución del producto. No tenés que pagar nada: los gastos de devolución corren por nuestra cuenta y te reintegramos el total pagado por el mismo medio de pago.",
      ) +
      p("El producto tiene que volver en el mismo estado en que lo recibiste.") +
      p(contactLine(links)),
  );
  const text = [
    `Hola ${firstName(w.fullName)}, registramos tu solicitud para arrepentirte de una compra.`,
    `Código de solicitud: ${w.code}\nRecibida: ${w.receivedAt}${w.orderNumber ? `\nPedido: #${w.orderNumber}` : ""}`,
    "En breve te escribimos para coordinar la devolución del producto. Los gastos de devolución corren por nuestra cuenta y te reintegramos el total pagado por el mismo medio de pago.",
    "El producto tiene que volver en el mismo estado en que lo recibiste.",
  ].join("\n\n");
  return { subject, html, text };
}

export function withdrawalOwnersEmail(w: EmailWithdrawal, links: EmailLinks): RenderedEmail {
  const subject = `Arrepentimiento ${w.code}${w.orderNumber ? ` · pedido #${w.orderNumber}` : ""}`;
  const order = w.orderNumber
    ? line(
        `Pedido: #${w.orderNumber}${w.orderMatched ? "" : ` <span style="color:${MUTED};">(no coincide con el email: revisalo)</span>`}`,
      )
    : line("Pedido: no lo indicó", true);
  const html = layout(
    links,
    `${w.fullName} pidió arrepentirse de una compra.`,
    heading("Nueva solicitud de arrepentimiento") +
      p(
        "Un cliente usó el Botón de arrepentimiento. Ya recibió su código por mail; ahora hay que contactarlo para coordinar la devolución.",
      ) +
      box(
        "Solicitud",
        line(`Código: <strong>${esc(w.code)}</strong>`) +
          line(`<strong>${esc(w.fullName)}</strong>`) +
          line(esc(w.email), true) +
          order +
          (w.reason ? line(`Motivo: ${esc(w.reason)}`, true) : "") +
          line(`Recibida: ${esc(w.receivedAt)}`, true),
      ) +
      (links.panelUrl ? button(links.panelUrl, "Ver en el panel", INK) : ""),
  );
  const text = [
    `Nueva solicitud de arrepentimiento ${w.code}`,
    `${w.fullName} — ${w.email}`,
    w.orderNumber ? `Pedido: #${w.orderNumber}${w.orderMatched ? "" : " (no coincide con el email)"}` : "Pedido: no lo indicó",
    w.reason ? `Motivo: ${w.reason}` : "",
    `Recibida: ${w.receivedAt}`,
    links.panelUrl ? `Ver en el panel: ${links.panelUrl}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
  return { subject, html, text };
}

export function reviewOwnersEmail(o: EmailOrder, links: EmailLinks): RenderedEmail {
  const subject = `Pedido #${o.number} para revisar`;
  const reason = o.reviewReason ?? "Hay algo en el pago que conviene revisar.";
  const html = layout(
    links,
    reason,
    heading(`Pedido #${o.number} para revisar`) +
      p(esc(reason)) +
      box("Cliente", line(`<strong>${esc(o.customerName)}</strong>`) + line(esc(o.customerEmail), true)) +
      (links.panelUrl ? button(links.panelUrl, "Ver en el panel", INK) : ""),
  );
  const text = [`Pedido #${o.number} para revisar`, reason, links.panelUrl ? `Ver en el panel: ${links.panelUrl}` : ""]
    .filter(Boolean)
    .join("\n\n");
  return { subject, html, text };
}
