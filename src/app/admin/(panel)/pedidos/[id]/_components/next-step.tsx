"use client";

import { useState, useTransition } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  PackageCheck,
  PackageOpen,
  PackageX,
  Pencil,
  Store,
  Truck,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CARRIERS, type Carrier } from "@/lib/carriers";
import { resolveReview, resolveStockIssue, setOrderStatus, shipOrder } from "../../actions";
import type { FulfillmentStatus } from "../../status";
import type { ActionResult } from "../../types";
import { CancelOrderButton } from "./cancel-order";
import { WhatsAppButton } from "./whatsapp-button";

export type NextStepOrder = {
  id: string;
  number: number;
  status: FulfillmentStatus;
  paymentApproved: boolean;
  pickup: boolean;
  stockIssue: boolean;
  needsReview: boolean;
  reviewReason: string | null;
  /** Mercado Pago aprobó, pero el monto no coincidía (se puede confirmar a mano). */
  canApproveManually: boolean;
  canCancel: boolean;
  cancelReason: string | null;
  cancelledAt: string | null;
  stockReturned: boolean;
  tracking: { carrier: Carrier; carrierName: string; code: string; url: string } | null;
  trackingLabel: string | null;
  /** Link de WhatsApp con el mensaje del estado actual (null si el teléfono no sirve). */
  whatsappUrl: string | null;
};

/**
 * "Próximo paso": UNA tarjeta arriba de todo que dice qué hay que hacer con
 * este pedido y tiene el botón para hacerlo. Las reglas de qué estado sigue
 * a cuál están en la base (set_order_status); acá solo se muestra lo posible.
 */
export function NextStep({ order }: { order: NextStepOrder }) {
  const [pending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState<null | { to: FulfillmentStatus; title: string; text: string; button: string }>(null);

  function run(action: () => Promise<ActionResult>, after?: () => void) {
    startTransition(async () => {
      try {
        const result = await action();
        if (result.ok) {
          toast.success(result.message);
          after?.();
        } else toast.error(result.error);
      } catch {
        toast.error("No se pudo completar. Revisá tu conexión e intentá de nuevo.");
      }
    });
  }

  const advance = (to: FulfillmentStatus) => run(() => setOrderStatus(order.id, to), () => setConfirm(null));

  const confirmDialog = (
    <AlertDialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{confirm?.title}</AlertDialogTitle>
          <AlertDialogDescription>{confirm?.text}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Volver</AlertDialogCancel>
          <AlertDialogAction disabled={pending} onClick={() => confirm && advance(confirm.to)}>
            {pending && <Loader2 className="animate-spin" />}
            {confirm?.button}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  // ---- Cancelado --------------------------------------------------------
  if (order.status === "cancelled") {
    return (
      <StepCard tone="muted" icon={XCircle} title="Pedido cancelado">
        <p>
          {order.stockReturned ? "El stock de los productos ya volvió al inventario. " : ""}
          Si el cliente había pagado, <strong className="font-medium text-foreground">la devolución del dinero se hace desde Mercado Pago</strong>{" "}
          (Actividad → el pago → Devolver dinero).
        </p>
        {order.cancelReason && <p>Motivo: {order.cancelReason}</p>}
        {order.whatsappUrl && <WhatsAppButton href={order.whatsappUrl} label="Avisarle al cliente por WhatsApp" />}
      </StepCard>
    );
  }

  // ---- Pagado sin stock -------------------------------------------------
  if (order.stockIssue) {
    return (
      <StepCard tone="red" icon={PackageX} title="Pagado sin stock">
        <p>
          El cliente pagó, pero cuando llegó el pago ya no alcanzaba el stock (alguien compró las últimas unidades casi al
          mismo tiempo). No se descontó nada. Escribile al cliente y elegí cómo seguir:
        </p>
        {order.whatsappUrl && <WhatsAppButton href={order.whatsappUrl} label="Escribirle al cliente por WhatsApp" />}
        <ResolveStockIssue orderId={order.id} pending={pending} run={run} />
        <div className="flex flex-col gap-1.5 border-t pt-3">
          <p className="text-xs">¿No se puede resolver? Cancelá el pedido y devolvé el dinero desde Mercado Pago.</p>
          <CancelOrderButton orderId={order.id} number={order.number} stockReturns={false} />
        </div>
      </StepCard>
    );
  }

  // ---- Para revisar -----------------------------------------------------
  if (order.needsReview) {
    return (
      <StepCard tone="amber" icon={AlertTriangle} title="Para revisar">
        <p>{order.reviewReason ?? "Hay algo de este pedido que conviene revisar antes de prepararlo."}</p>
        <ResolveReview orderId={order.id} canApprove={order.canApproveManually} pending={pending} run={run} />
        {order.canCancel && (
          <div className="flex flex-col gap-1.5 border-t pt-3">
            <p className="text-xs">Si el pago se devolvió, cancelá el pedido: el stock vuelve solo.</p>
            <CancelOrderButton orderId={order.id} number={order.number} stockReturns />
          </div>
        )}
      </StepCard>
    );
  }

  // ---- Sin pagar ---------------------------------------------------------
  if (!order.paymentApproved) {
    return (
      <StepCard tone="muted" icon={Clock} title="Esperando el pago">
        <p>
          El cliente todavía no pagó este pedido. No hace falta hacer nada: si paga, pasa solo a «Para preparar» y se
          descuenta el stock. Si no paga, queda así y no afecta nada.
        </p>
      </StepCard>
    );
  }

  // ---- Despacho ----------------------------------------------------------
  switch (order.status) {
    case "paid":
      return (
        <StepCard tone="action" icon={PackageOpen} title="Para preparar">
          <p>
            Juntá los productos y armá el paquete. Al empezar, marcalo como «Preparando»: así queda claro que ya se está
            armando y nadie lo prepara dos veces.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="lg" onClick={() => advance("preparing")} disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : <PackageOpen />}
              Marcar como Preparando
            </Button>
            {order.pickup ? (
              <Button
                size="lg"
                variant="outline"
                disabled={pending}
                onClick={() =>
                  setConfirm({
                    to: "ready_for_pickup",
                    title: "¿El pedido ya está listo para retirar?",
                    text: "Le avisamos al cliente que puede pasar a buscarlo.",
                    button: "Sí, está listo",
                  })
                }
              >
                <Store /> Ya está listo para retirar
              </Button>
            ) : null}
          </div>
          {!order.pickup && (
            <details className="group">
              <summary className="cursor-pointer text-sm font-medium text-foreground underline-offset-4 hover:underline">
                ¿Ya lo despachaste? Cargá el seguimiento
              </summary>
              <div className="pt-3">
                <ShipForm order={order} pending={pending} run={run} />
              </div>
            </details>
          )}
          {confirmDialog}
        </StepCard>
      );

    case "preparing":
      return order.pickup ? (
        <StepCard tone="action" icon={Store} title="Preparando (retiro en el local)">
          <p>Cuando el paquete esté armado, avisale al cliente que puede pasar a buscarlo.</p>
          <div>
            <Button
              size="lg"
              disabled={pending}
              onClick={() =>
                setConfirm({
                  to: "ready_for_pickup",
                  title: "¿El pedido ya está listo para retirar?",
                  text: "Le avisamos al cliente que puede pasar a buscarlo.",
                  button: "Sí, está listo",
                })
              }
            >
              <Store /> Listo para retirar
            </Button>
          </div>
          {confirmDialog}
        </StepCard>
      ) : (
        <StepCard tone="action" icon={Truck} title="Preparando (envío)">
          <p>Cuando lo despaches, elegí la empresa y cargá el código de seguimiento que te dieron.</p>
          <ShipForm order={order} pending={pending} run={run} />
        </StepCard>
      );

    case "shipped":
      return (
        <StepCard tone="progress" icon={Truck} title="Enviado">
          <p>
            En camino por <strong className="font-medium text-foreground">{order.trackingLabel}</strong>. Cuando el
            cliente lo reciba (o el seguimiento diga «entregado»), marcalo como entregado.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="lg"
              disabled={pending}
              onClick={() =>
                setConfirm({
                  to: "delivered",
                  title: "¿Marcar el pedido como entregado?",
                  text: "Después no se puede volver a «Enviado».",
                  button: "Sí, se entregó",
                })
              }
            >
              <PackageCheck /> Marcar como entregado
            </Button>
            {order.whatsappUrl && <WhatsAppButton href={order.whatsappUrl} label="Avisar por WhatsApp" size="lg" />}
          </div>
          <details className="group">
            <summary className="flex cursor-pointer items-center gap-1.5 text-sm font-medium text-foreground underline-offset-4 hover:underline">
              <Pencil className="size-3.5" aria-hidden /> Corregir la empresa o el código
            </summary>
            <div className="pt-3">
              <ShipForm order={order} pending={pending} run={run} correcting />
            </div>
          </details>
          {confirmDialog}
        </StepCard>
      );

    case "ready_for_pickup":
      return (
        <StepCard tone="progress" icon={Store} title="Listo para retirar">
          <p>Cuando el cliente pase a buscarlo, marcalo como retirado.</p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="lg"
              disabled={pending}
              onClick={() =>
                setConfirm({
                  to: "picked_up",
                  title: "¿El cliente ya retiró el pedido?",
                  text: "Después no se puede volver a «Listo para retirar».",
                  button: "Sí, lo retiró",
                })
              }
            >
              <PackageCheck /> Marcar como retirado
            </Button>
            {order.whatsappUrl && <WhatsAppButton href={order.whatsappUrl} label="Avisar por WhatsApp" size="lg" />}
          </div>
          {confirmDialog}
        </StepCard>
      );

    default:
      return (
        <StepCard tone="done" icon={CheckCircle2} title={order.status === "delivered" ? "Entregado" : "Retirado"}>
          <p>Pedido completo. No hay nada más para hacer.</p>
        </StepCard>
      );
  }
}

// ---------------------------------------------------------------------------
// Tarjeta
// ---------------------------------------------------------------------------
const TONES = {
  action: "border-foreground/20 bg-card",
  progress: "border-sky-200 bg-sky-50/60",
  done: "border-emerald-200 bg-emerald-50/60",
  muted: "bg-card",
  red: "border-brand/30 bg-brand-soft/60",
  amber: "border-amber-300 bg-amber-50/70",
} as const;

const ICON_TONES: Record<keyof typeof TONES, string> = {
  action: "bg-foreground text-background",
  progress: "bg-sky-100 text-sky-800",
  done: "bg-emerald-100 text-emerald-700",
  muted: "bg-muted text-muted-foreground",
  red: "bg-brand text-white",
  amber: "bg-amber-200 text-amber-900",
};

function StepCard({
  tone,
  icon: Icon,
  title,
  children,
}: {
  tone: keyof typeof TONES;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-label={`Próximo paso: ${title}`}
      className={cn("flex flex-col gap-3 rounded-xl border p-5 shadow-(--shadow-card)", TONES[tone])}
    >
      <div className="flex items-center gap-3">
        <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-full", ICON_TONES[tone])}>
          <Icon className="size-5" />
        </span>
        <div className="flex flex-col">
          <span className="text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">Próximo paso</span>
          <h2 className="text-lg leading-tight font-semibold">{title}</h2>
        </div>
      </div>
      <div className="flex flex-col gap-3 text-sm text-muted-foreground">{children}</div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Formulario de envío: empresa + código
// ---------------------------------------------------------------------------
function ShipForm({
  order,
  pending,
  run,
  correcting = false,
}: {
  order: NextStepOrder;
  pending: boolean;
  run: (action: () => Promise<ActionResult>) => void;
  correcting?: boolean;
}) {
  const [carrier, setCarrier] = useState<Carrier | null>(order.tracking?.carrier ?? null);
  const [code, setCode] = useState(order.tracking?.code ?? "");
  const [name, setName] = useState(order.tracking?.carrierName ?? "");
  const [url, setUrl] = useState(order.tracking?.url ?? "");
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!carrier) return setError("Elegí la empresa de envío.");
    if (!code.trim()) return setError("Escribí el código de seguimiento.");
    if (carrier === "otra" && !name.trim()) return setError("Escribí el nombre de la empresa.");
    setError(null);
    run(() => shipOrder({ orderId: order.id, carrier, carrierName: name, trackingCode: code, trackingUrl: url }));
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 text-foreground" noValidate>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">Empresa de envío</legend>
        <div role="radiogroup" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {CARRIERS.map((c) => (
            <button
              key={c.value}
              type="button"
              role="radio"
              aria-checked={carrier === c.value}
              onClick={() => setCarrier(c.value)}
              className={cn(
                "h-11 rounded-lg border px-3 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/20",
                carrier === c.value ? "border-foreground bg-foreground text-background" : "bg-background hover:bg-muted",
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
      </fieldset>

      {carrier === "otra" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`carrier-name-${order.id}`}>Nombre de la empresa</Label>
            <Input
              id={`carrier-name-${order.id}`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              placeholder="Ej.: Vía Cargo"
              className="h-10 bg-background"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`carrier-url-${order.id}`}>
              Link de seguimiento <span className="font-normal text-muted-foreground">(opcional)</span>
            </Label>
            <Input
              id={`carrier-url-${order.id}`}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              maxLength={500}
              inputMode="url"
              placeholder="https://…"
              className="h-10 bg-background"
            />
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`tracking-${order.id}`}>Código de seguimiento</Label>
        <Input
          id={`tracking-${order.id}`}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          maxLength={60}
          autoComplete="off"
          spellCheck={false}
          placeholder="Tal como figura en el comprobante"
          className="h-11 bg-background font-mono text-base tracking-wide"
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div>
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <Truck />}
          {correcting ? "Guardar el seguimiento" : "Marcar como enviado"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        {correcting
          ? "Si el servicio de mails está activo, el cliente recibe un mail con el código nuevo."
          : "Si el servicio de mails está activo, el cliente recibe un mail con el seguimiento. Después podés avisarle también por WhatsApp."}
      </p>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Resolver "Pagado sin stock"
// ---------------------------------------------------------------------------
function ResolveStockIssue({
  orderId,
  pending,
  run,
}: {
  orderId: string;
  pending: boolean;
  run: (action: () => Promise<ActionResult>) => void;
}) {
  const [manual, setManual] = useState(false);
  const [note, setNote] = useState("");
  return (
    <div className="flex flex-col gap-3 text-foreground">
      <div className="flex flex-col gap-1.5 rounded-lg border bg-background p-3">
        <p className="text-sm font-medium">Ya entró stock (o lo encontraste)</p>
        <p className="text-xs text-muted-foreground">
          Primero cargá el ingreso en Stock. Después tocá el botón: se descuenta el stock del pedido y sigue «Para preparar».
        </p>
        <div>
          <Button variant="outline" disabled={pending} onClick={() => run(() => resolveStockIssue(orderId, "apply_stock", ""))}>
            {pending ? <Loader2 className="animate-spin" /> : <PackageCheck />}
            Descontar el stock y seguir
          </Button>
        </div>
      </div>
      <div className="flex flex-col gap-1.5 rounded-lg border bg-background p-3">
        <p className="text-sm font-medium">Lo resolvieron de otra forma</p>
        <p className="text-xs text-muted-foreground">
          Por ejemplo: el cliente aceptó otro color. Ajustá el stock a mano en Stock si hace falta y contá qué hicieron.
        </p>
        {manual ? (
          <div className="flex flex-col gap-2">
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={300}
              rows={2}
              placeholder="Ej.: Le mandamos la taza en azul; ajustamos el stock."
              aria-label="Cómo lo resolvieron"
              className="bg-background"
            />
            <div className="flex gap-2">
              <Button
                disabled={pending || !note.trim()}
                onClick={() => run(() => resolveStockIssue(orderId, "manual", note))}
              >
                {pending && <Loader2 className="animate-spin" />}
                Guardar y seguir
              </Button>
              <Button variant="ghost" onClick={() => setManual(false)} disabled={pending}>
                Volver
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <Button variant="outline" onClick={() => setManual(true)}>
              Lo resolvimos de otra forma
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Resolver "Para revisar"
// ---------------------------------------------------------------------------
function ResolveReview({
  orderId,
  canApprove,
  pending,
  run,
}: {
  orderId: string;
  canApprove: boolean;
  pending: boolean;
  run: (action: () => Promise<ActionResult>) => void;
}) {
  const [mode, setMode] = useState<"approve" | "dismiss" | null>(null);
  const [note, setNote] = useState("");

  if (mode) {
    return (
      <div className="flex flex-col gap-2 rounded-lg border bg-background p-3 text-foreground">
        <p className="text-sm font-medium">{mode === "approve" ? "Confirmar el pago igual" : "Marcar como revisado"}</p>
        <p className="text-xs text-muted-foreground">
          {mode === "approve"
            ? "Hacelo solo si en tu cuenta de Mercado Pago ves el pago acreditado y estás de acuerdo con el monto. Se descuenta el stock y el pedido pasa a «Para preparar»."
            : "Contá brevemente qué revisaron. El pedido queda como estaba, sin el aviso."}
        </p>
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={300}
          rows={2}
          placeholder={mode === "approve" ? "Ej.: Lo vimos acreditado en Mercado Pago." : "Ej.: Hablamos con el cliente, todo bien."}
          aria-label="Nota"
          className="bg-background"
        />
        <div className="flex gap-2">
          <Button
            disabled={pending || (mode === "dismiss" && !note.trim())}
            onClick={() => run(() => resolveReview(orderId, mode, note))}
          >
            {pending && <Loader2 className="animate-spin" />}
            {mode === "approve" ? "Confirmar el pago" : "Marcar como revisado"}
          </Button>
          <Button variant="ghost" onClick={() => setMode(null)} disabled={pending}>
            Volver
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {canApprove && (
        <Button onClick={() => setMode("approve")}>
          <CheckCircle2 /> Confirmar el pago igual
        </Button>
      )}
      <Button variant="outline" onClick={() => setMode("dismiss")}>
        Marcar como revisado
      </Button>
    </div>
  );
}
