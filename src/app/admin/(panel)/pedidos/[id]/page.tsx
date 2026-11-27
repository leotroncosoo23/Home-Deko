import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import {
  ArrowLeft,
  CircleDollarSign,
  ExternalLink,
  History,
  Mail,
  MapPin,
  Phone,
  ShoppingBag,
  Store,
  Truck,
  User,
} from "lucide-react";
import { cn } from "cn";
import { HelpSheet } from "@/components/admin/help-sheet";
import { SectionCard } from "@/components/admin/section-card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatARS } from "@/lib/format";
import { customerMessage, whatsappToCustomer } from "@/lib/order-messages";
import { customerOrderUrl } from "@/lib/order-token";
import { paymentCopy } from "@/lib/payments/config";
import { paymentPlanLabel } from "@/lib/pricing";
import { publicImageUrl } from "@/lib/storage";
import { getOrderDetail, type OrderDetail, type OrderEvent } from "../data";
import {
  DELIVERY_LABELS,
  EVENT_LABELS,
  formatOrderDate,
  FULFILLMENT_LABELS,
  FULFILLMENT_STYLES,
  PAYMENT_LABELS,
  PAYMENT_STYLES,
  STEPS,
} from "../status";
import { CancelOrderButton } from "./_components/cancel-order";
import { CopyButton } from "./_components/copy-button";
import { NextStep, type NextStepOrder } from "./_components/next-step";
import { PrintButtons } from "./_components/print-buttons";
import { VerifyPaymentButton } from "./_components/verify-payment";
import { WhatsAppButton } from "./_components/whatsapp-button";

export const metadata: Metadata = { title: "Pedido" };

/**
 * /admin/pedidos/[id] — todo sobre un pedido: qué hay que hacer ahora
 * ("Próximo paso"), cliente, productos, pago, entrega y la línea de tiempo.
 */
export default function OrderDetailPage({ params }: PageProps<"/admin/pedidos/[id]">) {
  return (
    <Suspense fallback={<DetailSkeleton />}>
      {params.then(({ id }) => (
        <OrderDetailContent id={id} />
      ))}
    </Suspense>
  );
}

async function OrderDetailContent({ id }: { id: string }) {
  const order = await getOrderDetail(id);
  if (!order) notFound();

  const pickup = order.delivery_method === "pickup";
  const approved = order.payment_status === "approved";
  // Proveedor con el que se INICIÓ este pago (no el activo hoy).
  const getnet = order.payment_provider === "getnet";
  const copy = paymentCopy(getnet ? "getnet" : "mercadopago");
  const providerStatus = order.provider_status ?? order.mp_status;
  const paymentId = order.payment_id ?? order.mp_payment_id;
  const orderUrl = customerOrderUrl(order.id);
  const whatsappUrl = whatsappToCustomer(
    order.customer_phone,
    customerMessage({
      number: order.order_number,
      customerName: order.customer_name,
      status: order.fulfillment_status,
      pickupAddress: order.pickup_address,
      pickupHours: order.pickup_hours,
      tracking: order.tracking,
      orderUrl,
    }),
  );

  const next: NextStepOrder = {
    id: order.id,
    number: order.order_number,
    status: order.fulfillment_status,
    paymentApproved: approved,
    pickup,
    stockIssue: order.stock_issue,
    needsReview: order.needs_review,
    reviewReason: order.review_reason,
    canApproveManually: providerStatus === "approved" && !approved && order.fulfillment_status === "awaiting_payment",
    providerName: copy.name,
    refundHow: copy.refundHow,
    canCancel: ["paid", "preparing", "ready_for_pickup"].includes(order.fulfillment_status),
    cancelReason: order.cancel_reason,
    cancelledAt: order.cancelled_at,
    stockReturned: Boolean(order.stock_returned_at),
    tracking:
      order.carrier && order.tracking_code
        ? {
            carrier: order.carrier,
            carrierName: order.carrier_name ?? "",
            code: order.tracking_code,
            url: order.tracking_url ?? "",
          }
        : null,
    trackingLabel: order.tracking ? `${order.tracking.carrierLabel} (${order.tracking.code})` : null,
    whatsappUrl,
  };

  // Cancelar (fuera de los avisos, que tienen su propio botón)
  const showCancel = next.canCancel && !order.stock_issue && !order.needs_review && approved;

  return (
    <div className="flex flex-col gap-5">
      {/* ----- Encabezado ----- */}
      <div className="flex flex-col gap-3">
        <Link
          href="/admin/pedidos"
          className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden /> Pedidos
        </Link>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-xs font-semibold tracking-[0.08em] text-brand uppercase">Ventas</span>
            <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight">
              Pedido #{order.order_number}
              {approved || order.fulfillment_status === "cancelled" ? (
                <Badge className={cn("text-sm", FULFILLMENT_STYLES[order.fulfillment_status])}>
                  {FULFILLMENT_LABELS[order.fulfillment_status]}
                </Badge>
              ) : (
                <Badge className={cn("text-sm", PAYMENT_STYLES[order.payment_status])}>
                  Pago {PAYMENT_LABELS[order.payment_status].toLowerCase()}
                </Badge>
              )}
            </h1>
            <p className="text-sm text-muted-foreground">
              {formatOrderDate(order.created_at)} · {DELIVERY_LABELS[order.delivery_method]} ·{" "}
              <span className="tabular-nums">{formatARS(Number(order.total))}</span>
            </p>
          </div>
          <HelpSheet guia="pedidos" />
        </div>
        {approved && order.fulfillment_status !== "cancelled" && (
          <Progress pickup={pickup} status={order.fulfillment_status} />
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        {/* ----- Columna principal ----- */}
        <div className="flex min-w-0 flex-col gap-5">
          <NextStep order={next} />
          <ItemsCard order={order} />
          <Timeline events={order.events} />
        </div>

        {/* ----- Columna lateral ----- */}
        <div className="flex min-w-0 flex-col gap-5">
          <SectionCard icon={User} title="Cliente" contentClassName="flex flex-col gap-2 text-sm">
            <p className="font-medium">{order.customer_name}</p>
            <p className="flex items-center justify-between gap-2">
              <a href={`mailto:${order.customer_email}`} className="flex min-w-0 items-center gap-2 hover:underline">
                <Mail className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="truncate">{order.customer_email}</span>
              </a>
              <CopyButton text={order.customer_email} label="Copiar el email" />
            </p>
            <p className="flex items-center justify-between gap-2">
              <a href={`tel:${order.customer_phone}`} className="flex items-center gap-2 tabular-nums hover:underline">
                <Phone className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                {order.customer_phone}
              </a>
              <CopyButton text={order.customer_phone} label="Copiar el teléfono" />
            </p>
            {order.billing?.customer_dni && (
              <p className="flex items-center justify-between gap-2">
                <span className="tabular-nums">
                  <span className="text-muted-foreground">DNI </span>
                  {order.billing.customer_dni}
                </span>
                <CopyButton text={order.billing.customer_dni} label="Copiar el DNI" />
              </p>
            )}
            {order.billing?.billing_street && (
              <p className="text-muted-foreground">
                Facturación: {order.billing.billing_street} {order.billing.billing_number}, CP{" "}
                {order.billing.billing_postal_code}
              </p>
            )}
            {whatsappUrl && (
              <div className="pt-1">
                <WhatsAppButton href={whatsappUrl} label="Escribir por WhatsApp" />
                <p className="mt-1.5 text-xs text-muted-foreground">Se abre con un mensaje ya escrito según el estado del pedido.</p>
              </div>
            )}
          </SectionCard>

          <SectionCard
            icon={pickup ? Store : Truck}
            title={DELIVERY_LABELS[order.delivery_method]}
            contentClassName="flex flex-col gap-3 text-sm"
          >
            {pickup ? (
              <div className="flex flex-col gap-1">
                <p>{order.pickup_address}</p>
                {order.pickup_hours && <p className="text-muted-foreground">{order.pickup_hours}</p>}
              </div>
            ) : (
              <div className="flex items-start justify-between gap-2">
                <p className="flex gap-2">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span>
                    {order.ship_address}
                    {order.ship_apartment && (
                      <>
                        <br />
                        Piso / Depto: {order.ship_apartment}
                      </>
                    )}
                    <br />
                    {order.ship_city}, {order.ship_province}
                    <br />
                    CP {order.ship_postal_code}
                  </span>
                </p>
                <CopyButton
                  text={[
                    order.customer_name,
                    order.ship_address,
                    order.ship_apartment && `Piso / Depto: ${order.ship_apartment}`,
                    `${order.ship_city}, ${order.ship_province}`,
                    `CP ${order.ship_postal_code}`,
                    `Tel.: ${order.customer_phone}`,
                    order.ship_notes && `Indicaciones: ${order.ship_notes}`,
                  ]
                    .filter(Boolean)
                    .join("\n")}
                  label="Copiar los datos del envío"
                />
              </div>
            )}
            {!pickup && order.ship_notes && (
              <div className="flex flex-col gap-0.5 rounded-lg border border-amber-200 bg-amber-50/70 p-3">
                <span className="text-xs font-medium text-amber-900">Indicaciones para la entrega</span>
                <span>{order.ship_notes}</span>
              </div>
            )}
            {order.tracking && (
              <div className="flex flex-col gap-1 rounded-lg border bg-muted/40 p-3">
                <span className="text-xs font-medium text-muted-foreground">Seguimiento · {order.tracking.carrierLabel}</span>
                <span className="flex items-center justify-between gap-2">
                  <span className="font-mono text-base tracking-wide">{order.tracking.code}</span>
                  <CopyButton text={order.tracking.code} label="Copiar el código de seguimiento" />
                </span>
                {order.tracking.url && (
                  <a
                    href={order.tracking.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex w-fit items-center gap-1 text-xs font-medium hover:underline"
                  >
                    Ver el seguimiento <ExternalLink className="size-3" aria-hidden />
                  </a>
                )}
              </div>
            )}
            <PrintButtons orderId={order.id} pickup={pickup} />
          </SectionCard>

          <SectionCard icon={CircleDollarSign} title="Pago" contentClassName="flex flex-col gap-2 text-sm">
            <p className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Estado</span>
              <Badge className={PAYMENT_STYLES[order.payment_status]}>{PAYMENT_LABELS[order.payment_status]}</Badge>
            </p>
            <p className="flex justify-between gap-2">
              <span className="text-muted-foreground">Medio</span>
              <span>{copy.name}</span>
            </p>
            <p className="flex justify-between gap-2">
              <span className="text-muted-foreground">Forma de pago</span>
              <span className="font-medium">{paymentPlanLabel(order.payment_plan, order.installments)}</span>
            </p>
            {order.paid_at && (
              <p className="flex justify-between gap-2">
                <span className="text-muted-foreground">Fecha</span>
                <span className="tabular-nums">{formatOrderDate(order.paid_at)}</span>
              </p>
            )}
            {paymentId && (
              <p className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">N.º de operación</span>
                <span className="flex items-center gap-1 tabular-nums">
                  {paymentId}
                  <CopyButton text={paymentId} label={`Copiar el número de operación de ${copy.name}`} />
                </span>
              </p>
            )}
            {getnet && order.payment_intent_id && (
              <p className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Código del pago</span>
                <span className="flex min-w-0 items-center gap-1">
                  <span className="truncate font-mono text-xs">{order.payment_intent_id}</span>
                  <CopyButton text={order.payment_intent_id} label="Copiar el código del pago de Getnet" />
                </span>
              </p>
            )}
            {order.payment_status_detail && !approved && (
              <p className="flex justify-between gap-2">
                <span className="text-muted-foreground">Detalle</span>
                <span className="text-right">{order.payment_status_detail}</span>
              </p>
            )}
            <p className="flex justify-between gap-2 border-t pt-2 font-semibold">
              <span>Total cobrado</span>
              <span className="tabular-nums">{formatARS(Number(order.total))}</span>
            </p>
            <p className="text-xs text-muted-foreground">Para devolver dinero: hacé la devolución {copy.refundHow}.</p>
            {getnet && order.payment_intent_id && !approved && (
              <VerifyPaymentButton intentId={order.payment_intent_id} paymentId={paymentId} />
            )}
          </SectionCard>

          {showCancel && (
            <div className="flex flex-col gap-2 rounded-xl border bg-card p-4 text-sm">
              <p className="text-muted-foreground">
                ¿El cliente se arrepintió o no se puede entregar? Cancelá el pedido: el stock vuelve solo.
              </p>
              <CancelOrderButton
                orderId={order.id}
                number={order.order_number}
                stockReturns={Boolean(order.stock_applied_at)}
                refundHow={copy.refundHow}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pasos: Pagado → Preparando → Enviado → Entregado (o retiro)
// ---------------------------------------------------------------------------
function Progress({ pickup, status }: { pickup: boolean; status: OrderDetail["fulfillment_status"] }) {
  const steps = STEPS[pickup ? "pickup" : "shipping"];
  const current = steps.indexOf(status);
  return (
    <ol className="flex items-center gap-1.5 text-xs font-medium sm:gap-2 sm:text-sm" aria-label="Avance del pedido">
      {steps.map((step, i) => (
        <li key={step} className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2">
          <span
            className={cn(
              "flex size-5 shrink-0 items-center justify-center rounded-full text-[0.7rem] tabular-nums",
              i <= current ? "bg-foreground text-background" : "bg-muted text-muted-foreground",
            )}
            aria-hidden
          >
            {i + 1}
          </span>
          <span className={cn("truncate", i <= current ? "text-foreground" : "text-muted-foreground")} aria-current={i === current ? "step" : undefined}>
            {FULFILLMENT_LABELS[step]}
          </span>
          {i < steps.length - 1 && <span className={cn("hidden h-px flex-1 sm:block", i < current ? "bg-foreground" : "bg-border")} />}
        </li>
      ))}
    </ol>
  );
}

// ---------------------------------------------------------------------------
// Productos
// ---------------------------------------------------------------------------
function ItemsCard({ order }: { order: OrderDetail }) {
  const units = order.items.reduce((s, i) => s + i.quantity, 0);
  return (
    <SectionCard
      icon={ShoppingBag}
      title="Productos"
      description={units === 1 ? "1 unidad" : `${units} unidades`}
      contentClassName="flex flex-col gap-0 p-0"
    >
      <ul className="divide-y">
        {order.items.map((item) => (
          <li key={item.id} className="flex gap-3 px-5 py-3 text-sm">
            <span className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-muted">
              {item.image_path ? (
                <Image src={publicImageUrl(item.image_path)} alt="" fill sizes="56px" className="object-cover" />
              ) : (
                <span className="flex h-full items-center justify-center">
                  <ShoppingBag aria-hidden className="size-5 text-muted-foreground/40" />
                </span>
              )}
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              {item.product_id ? (
                <Link href={`/admin/productos/${item.product_id}`} className="line-clamp-2 font-medium hover:underline">
                  {item.product_name}
                </Link>
              ) : (
                <span className="line-clamp-2 font-medium">{item.product_name}</span>
              )}
              {item.variant_label && <span className="text-muted-foreground">{item.variant_label}</span>}
              <span className="text-muted-foreground tabular-nums">
                {formatARS(Number(item.unit_price))} c/u
                {item.unit_price_before && (
                  <span className="ml-1.5 line-through">{formatARS(Number(item.unit_price_before))}</span>
                )}
              </span>
            </span>
            <span className="flex flex-col items-end gap-0.5">
              <span className="rounded-md bg-muted px-2 py-0.5 text-sm font-semibold tabular-nums">× {item.quantity}</span>
              <span className="font-semibold tabular-nums">{formatARS(Number(item.line_total))}</span>
            </span>
          </li>
        ))}
      </ul>
      <dl className="flex flex-col gap-1.5 border-t px-5 py-4 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Subtotal</dt>
          <dd className="tabular-nums">{formatARS(Number(order.subtotal))}</dd>
        </div>
        {Number(order.discount_total) > 0 && (
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">{order.coupon_code ? `Cupón ${order.coupon_code}` : "Descuento"}</dt>
            <dd className="tabular-nums">− {formatARS(Number(order.discount_total))}</dd>
          </div>
        )}
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">{DELIVERY_LABELS[order.delivery_method]}</dt>
          <dd className="tabular-nums">
            {order.delivery_method === "pickup" ? "Gratis" : formatARS(Number(order.shipping_cost))}
          </dd>
        </div>
        <div className="flex justify-between gap-4 border-t pt-2 font-semibold">
          <dt>Total en {paymentPlanLabel(order.payment_plan, order.installments)}</dt>
          <dd className="tabular-nums">{formatARS(Number(order.total))}</dd>
        </div>
      </dl>
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Línea de tiempo
// ---------------------------------------------------------------------------
function eventTitle(e: OrderEvent): string {
  if (e.kind === "status" && e.to) return `Pasó a «${FULFILLMENT_LABELS[e.to]}»`;
  return EVENT_LABELS[e.kind];
}

function Timeline({ events }: { events: OrderEvent[] }) {
  return (
    <SectionCard icon={History} title="Historial" description="Cada cambio del pedido: qué pasó, quién y cuándo.">
      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground">Todavía no hay movimientos.</p>
      ) : (
        <ol className="flex flex-col">
          {events.map((e, i) => (
            <li key={e.id} className="relative flex gap-3 pb-4 last:pb-0">
              {i < events.length - 1 && <span className="absolute top-3 left-1.25 h-full w-px bg-border" aria-hidden />}
              <span
                className={cn(
                  "relative mt-1.5 size-2.75 shrink-0 rounded-full border-2 border-card",
                  e.kind === "email_failed" || e.kind === "needs_review"
                    ? "bg-amber-500"
                    : e.kind === "cancelled"
                      ? "bg-brand"
                      : e.kind === "email_sent"
                        ? "bg-muted-foreground/50"
                        : "bg-foreground",
                )}
                aria-hidden
              />
              <div className="flex min-w-0 flex-col gap-0.5 text-sm">
                <p className="font-medium">{eventTitle(e)}</p>
                {e.note && <p className="text-muted-foreground">{e.note}</p>}
                <p className="text-xs text-muted-foreground tabular-nums">
                  {formatOrderDate(e.createdAt)} · {e.actor ?? (e.kind.startsWith("email") ? "Automático" : "La tienda")}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </SectionCard>
  );
}

function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-8 w-56" />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex flex-col gap-5">
          <Skeleton className="h-44 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
        <div className="flex flex-col gap-5">
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}
