import { Suspense } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Check, CheckCircle2, Clock, ExternalLink, ShoppingBag, Truck, XCircle } from "lucide-react";
import { AutoRefresh, ClearCartOnApproved, CopyCode } from "@/components/store/checkout/order-client";
import { trackingFor, type Tracking } from "@/lib/carriers";
import { WhatsAppIcon } from "@/components/store/whatsapp-icon";
import { formatARS, titleCase } from "@/lib/format";
import { publicImageUrl } from "@/lib/storage";
import { STORE_CONTAINER } from "@/lib/store-layout";
import { ALL_PRODUCTS_LINK, CHECKOUT_PATH } from "@/lib/store-nav";
import { getStoreSettings, whatsappLink } from "@/lib/store-settings";
import { cn } from "@/lib/utils";
import { getGuestOrder, type GuestOrder } from "./data";

export const metadata: Metadata = {
  title: "Tu pedido",
  robots: { index: false, follow: false },
  // El link tiene un código secreto: que no viaje a otros sitios al hacer clic.
  referrer: "no-referrer",
};

/**
 * /pedido/[id]?t=... — a donde vuelve el cliente desde Mercado Pago.
 *
 * Muestra el estado REAL del pedido en la base (que solo cambia el
 * webhook), nunca lo que diga la URL de regreso de Mercado Pago.
 * Sin el token correcto: 404 (cambiar el id no muestra pedidos ajenos).
 */
export default function OrderPage({ params, searchParams }: PageProps<"/pedido/[id]">) {
  return (
    <main className={cn(STORE_CONTAINER, "flex flex-1 flex-col items-center py-10 md:py-14")}>
      <Suspense fallback={<OrderSkeleton />}>
        <OrderContent params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

type View = {
  tone: "ok" | "wait" | "bad";
  title: string;
  text: string;
  poll?: boolean;
  retry?: boolean;
};

function viewFor(order: GuestOrder): View {
  const pickup = order.delivery_method === "pickup";

  // Cancelado por la tienda (después de pagar o al revisar un pago)
  if (order.fulfillment_status === "cancelled") {
    return {
      tone: "bad",
      title: "Tu pedido fue cancelado",
      text: "Si ya lo habías pagado, la devolución del dinero la ves en tu cuenta de Mercado Pago o en el resumen de tu tarjeta (según el medio de pago, puede demorar unos días). Cualquier duda, escribinos.",
    };
  }

  if (order.payment_status === "approved") {
    if (order.stock_issue) {
      return {
        tone: "ok",
        title: "¡Recibimos tu pago!",
        text: "Hubo un inconveniente con la disponibilidad de un producto. Vamos a comunicarnos con vos muy pronto para resolverlo, ya sea con otro producto o devolviéndote el dinero.",
      };
    }
    switch (order.fulfillment_status) {
      case "preparing":
        return {
          tone: "ok",
          title: "Estamos preparando tu pedido",
          text: pickup
            ? "Te avisamos por mail apenas esté listo para retirar."
            : "Te avisamos por mail cuando lo despachemos, con el código de seguimiento.",
        };
      case "shipped":
        return {
          tone: "ok",
          title: "¡Tu pedido está en camino!",
          text: "Ya lo despachamos. Con el código de seguimiento podés ver por dónde va.",
        };
      case "delivered":
        return {
          tone: "ok",
          title: "Tu pedido fue entregado",
          text: "¡Esperamos que lo disfrutes! Si algo no llegó bien, escribinos.",
        };
      case "ready_for_pickup":
        return {
          tone: "ok",
          title: "¡Tu pedido está listo para retirar!",
          text: "Ya podés pasar a buscarlo por el local. Al retirarlo, decinos tu nombre o el número de pedido.",
        };
      case "picked_up":
        return {
          tone: "ok",
          title: "¡Gracias por tu compra!",
          text: "Ya retiraste tu pedido. ¡Esperamos que lo disfrutes!",
        };
    }
    return {
      tone: "ok",
      title: "¡Gracias por tu compra!",
      text: pickup
        ? "Recibimos tu pago. Te avisamos cuando tu pedido esté listo para retirar."
        : "Recibimos tu pago. Vamos a preparar tu pedido y te avisamos cuando lo despachemos, con el código de seguimiento.",
    };
  }

  if (order.needs_review) {
    return {
      tone: "wait",
      title: "Estamos revisando tu pago",
      text: "Necesitamos verificar un detalle de tu pago. Te vamos a escribir muy pronto; si querés, consultanos por WhatsApp.",
    };
  }

  if (order.payment_status === "rejected") {
    return {
      tone: "bad",
      title: "El pago no se completó",
      text: "Mercado Pago no aprobó el pago. Podés intentar de nuevo con otra tarjeta o medio de pago: tu carrito sigue guardado.",
      retry: true,
    };
  }

  if (order.payment_status === "cancelled") {
    return {
      tone: "bad",
      title: "El pago se canceló",
      text: "Este pago quedó cancelado. Si querés, podés volver a intentarlo: tu carrito sigue guardado.",
      retry: true,
    };
  }

  // Pendiente
  if (order.mp_status === "pending" || order.mp_status === "in_process") {
    return {
      tone: "wait",
      title: "Tu pago está en revisión",
      text: "Mercado Pago está procesando tu pago. Puede demorar un rato: volvé a esta página más tarde para ver el estado.",
    };
  }

  const expired = !order.mp_status && order.mp_expires_at && new Date(order.mp_expires_at).getTime() < Date.now();
  if (expired) {
    return {
      tone: "bad",
      title: "Venció el tiempo para pagar",
      text: "No recibimos el pago de este pedido. Podés volver a intentarlo: tu carrito sigue guardado.",
      retry: true,
    };
  }

  return {
    tone: "wait",
    title: "Estamos confirmando tu pago",
    text: "Esto tarda solo unos segundos. No hace falta que hagas nada: esta página se actualiza sola.",
    poll: true,
  };
}

async function OrderContent({ params, searchParams }: Pick<PageProps<"/pedido/[id]">, "params" | "searchParams">) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  // El estado depende de la hora actual ("vencido" usa Date.now() en viewFor) y
  // el pedido se lee con la clave de servicio (que no lee cookies): connection()
  // le avisa a Next que esto se arma en cada pedido, nunca de antemano.
  await connection();
  const [order, settings] = await Promise.all([getGuestOrder(id, query.t), getStoreSettings()]);
  if (!order) notFound();

  const view = viewFor(order);
  const tracking = trackingFor(order);
  const wa = whatsappLink(settings, `Hola Home Deko, te escribo por mi pedido #${order.order_number}.`);
  const Icon = view.tone === "ok" ? CheckCircle2 : view.tone === "wait" ? Clock : XCircle;

  return (
    <div className="flex w-full max-w-xl flex-col gap-6">
      {order.payment_status === "approved" && <ClearCartOnApproved orderId={order.id} createdAt={order.created_at} />}

      <div className="flex flex-col items-center gap-4 text-center" role="status">
        <span
          className={cn(
            "flex size-16 items-center justify-center rounded-full",
            view.tone === "ok" && "bg-emerald-50 text-emerald-600",
            view.tone === "wait" && "bg-amber-50 text-amber-600",
            view.tone === "bad" && "bg-brand-soft text-brand",
          )}
        >
          <Icon aria-hidden className="size-8" />
        </span>
        <p className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          Pedido #{order.order_number}
        </p>
        <h1 className="font-display text-3xl leading-tight font-semibold tracking-tight md:text-4xl">{view.title}</h1>
        <p className="text-[15px] leading-7 text-muted-foreground md:text-base">{view.text}</p>
        {view.poll && <AutoRefresh />}
      </div>

      {order.payment_status === "approved" && !order.stock_issue && order.fulfillment_status !== "cancelled" && (
        <OrderProgress order={order} />
      )}
      {tracking && order.fulfillment_status === "shipped" && <TrackingCard tracking={tracking} />}

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
        {view.retry && (
          <Link
            href={CHECKOUT_PATH}
            className="inline-flex h-12 items-center justify-center rounded-full bg-brand px-6 font-semibold text-white transition-colors hover:bg-brand-hover focus-visible:ring-3 focus-visible:ring-brand/30 focus-visible:outline-none"
          >
            Volver a intentar
          </Link>
        )}
        {wa && (
          <a
            href={wa}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-full border px-6 font-semibold transition-colors hover:bg-muted"
          >
            <WhatsAppIcon className="size-5 text-[#25D366]" />
            Escribinos por WhatsApp
            <span className="sr-only"> (se abre en otra pestaña)</span>
          </a>
        )}
        {!view.retry && (
          <Link
            href={ALL_PRODUCTS_LINK.href}
            className="inline-flex h-12 items-center justify-center rounded-full border px-6 font-semibold transition-colors hover:bg-muted"
          >
            Seguir comprando
          </Link>
        )}
      </div>

      <OrderSummary order={order} />
    </div>
  );
}

/** Pasos: Pago confirmado → Preparando → En camino → Entregado (o retiro). */
const CUSTOMER_STEPS = {
  shipping: [
    { status: "paid", label: "Pago confirmado" },
    { status: "preparing", label: "Preparando" },
    { status: "shipped", label: "En camino" },
    { status: "delivered", label: "Entregado" },
  ],
  pickup: [
    { status: "paid", label: "Pago confirmado" },
    { status: "preparing", label: "Preparando" },
    { status: "ready_for_pickup", label: "Listo para retirar" },
    { status: "picked_up", label: "Retirado" },
  ],
} as const;

function OrderProgress({ order }: { order: GuestOrder }) {
  const steps = CUSTOMER_STEPS[order.delivery_method];
  const current = steps.findIndex((s) => s.status === order.fulfillment_status);
  return (
    <ol className="grid grid-cols-4 gap-2" aria-label="Estado de tu pedido">
      {steps.map((step, i) => {
        const done = i <= current;
        return (
          <li key={step.status} className="flex flex-col items-center gap-2 text-center">
            <span className="flex w-full items-center">
              <span className={cn("h-0.5 flex-1", i === 0 ? "bg-transparent" : i <= current ? "bg-brand" : "bg-border")} />
              <span
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                  done ? "bg-brand text-white" : "border-2 border-border bg-background text-muted-foreground",
                )}
                aria-hidden
              >
                {done ? <Check className="size-4" /> : i + 1}
              </span>
              <span
                className={cn("h-0.5 flex-1", i === steps.length - 1 ? "bg-transparent" : i < current ? "bg-brand" : "bg-border")}
              />
            </span>
            <span
              className={cn("text-xs leading-tight sm:text-sm", done ? "font-semibold" : "text-muted-foreground")}
              aria-current={i === current ? "step" : undefined}
            >
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function TrackingCard({ tracking }: { tracking: Tracking }) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl border p-5" aria-labelledby="tracking-title">
      <h2 id="tracking-title" className="flex items-center gap-2 font-display text-xl font-semibold">
        <Truck aria-hidden className="size-5 text-brand" />
        Seguimiento del envío
      </h2>
      <p className="text-[15px] text-muted-foreground">
        Lo enviamos por <strong className="font-semibold text-foreground">{tracking.carrierLabel}</strong>.
      </p>
      <div className="flex flex-wrap items-center gap-3 rounded-xl bg-muted/60 px-4 py-3">
        <span className="flex flex-col">
          <span className="text-xs text-muted-foreground">Código de seguimiento</span>
          <span className="font-mono text-lg font-semibold tracking-wide">{tracking.code}</span>
        </span>
        <span className="ml-auto">
          <CopyCode code={tracking.code} />
        </span>
      </div>
      {tracking.url && (
        <>
          <a
            href={tracking.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-brand px-6 font-semibold text-white transition-colors hover:bg-brand-hover focus-visible:ring-3 focus-visible:ring-brand/30 focus-visible:outline-none"
          >
            Seguir mi envío <ExternalLink aria-hidden className="size-4" />
            <span className="sr-only"> (se abre en otra pestaña)</span>
          </a>
          {!tracking.urlHasCode && (
            <p className="text-sm text-muted-foreground">En la página de seguimiento, pegá el código.</p>
          )}
        </>
      )}
    </section>
  );
}

function OrderSummary({ order }: { order: GuestOrder }) {
  const pickup = order.delivery_method === "pickup";
  return (
    <section className="flex flex-col gap-4 rounded-2xl border p-5" aria-labelledby="order-summary">
      <h2 id="order-summary" className="font-display text-xl font-semibold">
        Detalle del pedido
      </h2>
      <ul className="flex flex-col divide-y">
        {order.items.map((item) => (
          <li key={item.id} className="flex gap-3 py-3 first:pt-0">
            <span className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-muted">
              {item.image_path ? (
                <Image src={publicImageUrl(item.image_path)} alt="" fill sizes="56px" className="object-cover" />
              ) : (
                <span className="flex h-full items-center justify-center">
                  <ShoppingBag aria-hidden className="size-5 text-muted-foreground/40" />
                </span>
              )}
            </span>
            <span className="flex min-w-0 flex-1 flex-col text-sm">
              <span className="line-clamp-2 font-medium">{item.product_name}</span>
              {item.variant_label && <span className="text-muted-foreground">{item.variant_label}</span>}
              <span className="text-muted-foreground tabular-nums">
                {item.quantity} × {formatARS(Number(item.unit_price))}
              </span>
            </span>
            <span className="text-sm font-semibold tabular-nums">{formatARS(Number(item.line_total))}</span>
          </li>
        ))}
      </ul>

      <dl className="flex flex-col gap-2 border-t pt-4 text-[15px]">
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Subtotal</dt>
          <dd className="tabular-nums">{formatARS(Number(order.subtotal))}</dd>
        </div>
        {Number(order.discount_total) > 0 && (
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">{order.coupon_code ? `Cupón ${order.coupon_code}` : "Descuento"}</dt>
            <dd className="text-brand tabular-nums">− {formatARS(Number(order.discount_total))}</dd>
          </div>
        )}
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">{pickup ? "Retiro en el local" : "Envío a domicilio"}</dt>
          <dd className="tabular-nums">{pickup ? "Gratis" : formatARS(Number(order.shipping_cost))}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-4 border-t pt-3">
          <dt className="font-semibold">Total</dt>
          <dd className="text-lg font-semibold tabular-nums">{formatARS(Number(order.total))}</dd>
        </div>
      </dl>

      <div className="flex flex-col gap-1 border-t pt-4 text-sm">
        <p className="font-semibold">{pickup ? "Dónde retirarlo" : "Dónde lo enviamos"}</p>
        {pickup ? (
          <>
            <p>{order.pickup_address}</p>
            {order.pickup_hours && <p className="text-muted-foreground">{order.pickup_hours}</p>}
          </>
        ) : (
          <>
            <p>
              {order.ship_address}
              {order.ship_apartment && `, ${order.ship_apartment}`}, {titleCase(order.ship_city)},{" "}
              {titleCase(order.ship_province)} ({order.ship_postal_code})
            </p>
            {order.ship_notes && <p className="text-muted-foreground">Indicaciones: {order.ship_notes}</p>}
          </>
        )}
        <p className="mt-2 text-muted-foreground">
          A nombre de {titleCase(order.customer_name)} · {order.customer_email}
        </p>
      </div>
    </section>
  );
}

function OrderSkeleton() {
  return (
    <div className="flex w-full max-w-xl flex-col items-center gap-4" aria-label="Cargando tu pedido">
      <div className="size-16 animate-pulse rounded-full bg-muted" />
      <div className="h-8 w-64 animate-pulse rounded bg-muted" />
      <div className="h-4 w-80 max-w-full animate-pulse rounded bg-muted" />
      <div className="mt-4 h-64 w-full animate-pulse rounded-2xl bg-muted" />
    </div>
  );
}
