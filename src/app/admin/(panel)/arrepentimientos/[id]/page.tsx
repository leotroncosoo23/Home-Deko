import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AlertTriangle, ArrowLeft, ClipboardList, Mail, MessageCircle, Phone, StickyNote, User } from "lucide-react";
import { cn } from "cn";
import { HelpSheet } from "@/components/admin/help-sheet";
import { SectionCard } from "@/components/admin/section-card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatArgentinaDateTime } from "@/lib/dates";
import { firstNameOf, formatARS } from "@/lib/format";
import { whatsappToCustomer } from "@/lib/order-messages";
import { CopyButton } from "../../pedidos/[id]/_components/copy-button";
import { getWithdrawalDetail, type WithdrawalDetail } from "../data";
import { LIST_PATH, STATUS_LABELS, STATUS_STYLES } from "../status";
import { StatusActions } from "./_components/status-actions";

export const metadata: Metadata = { title: "Solicitud de arrepentimiento" };

/**
 * /admin/arrepentimientos/[id] — una solicitud del Botón de arrepentimiento:
 * qué hacer ahora, cómo contactar al cliente, el pedido (si coincidió) y la gestión.
 */
export default function WithdrawalDetailPage({ params }: PageProps<"/admin/arrepentimientos/[id]">) {
  return (
    <Suspense fallback={<DetailSkeleton />}>
      {params.then(({ id }) => (
        <DetailContent id={id} />
      ))}
    </Suspense>
  );
}

/** Qué hacer en cada estado (tarjeta "Próximo paso"). */
const NEXT_STEP: Record<WithdrawalDetail["status"], string> = {
  new: "El cliente ya recibió su código por mail. Escribile para coordinar la devolución del producto y marcala «En gestión».",
  in_progress:
    "Cuando el producto vuelva, devolvé el dinero desde el portal del medio de pago con el que se cobró (Getnet o Mercado Pago) y marcala «Resuelta».",
  resolved: "Listo: la solicitud está resuelta.",
  rejected: "La solicitud quedó cerrada como «No corresponde».",
};

async function DetailContent({ id }: { id: string }) {
  const w = await getWithdrawalDetail(id);
  if (!w) notFound();

  const greeting = `Hola ${firstNameOf(w.fullName)}, te escribimos de Home Deko por tu solicitud de arrepentimiento ${w.code}.`;
  const whatsappUrl = w.order ? whatsappToCustomer(w.order.phone, greeting) : null;
  const mailto = `mailto:${w.email}?subject=${encodeURIComponent(`Tu solicitud de arrepentimiento ${w.code}`)}&body=${encodeURIComponent(`${greeting}\n\n`)}`;

  return (
    <div className="flex flex-col gap-5">
      {/* ----- Encabezado ----- */}
      <div className="flex flex-col gap-3">
        <Link
          href={LIST_PATH}
          className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden /> Arrepentimientos
        </Link>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold tracking-[0.08em] text-brand uppercase">Ventas</span>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-mono text-2xl font-semibold tracking-tight">{w.code}</h1>
              <Badge className={cn("text-sm", STATUS_STYLES[w.status])}>{STATUS_LABELS[w.status]}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Recibida el {formatArgentinaDateTime(w.createdAt)} ({w.receivedAgo})
            </p>
          </div>
          <HelpSheet guia="arrepentimientos" />
        </div>
      </div>

      {/* ----- Próximo paso ----- */}
      <SectionCard icon={ClipboardList} title="Próximo paso" description={NEXT_STEP[w.status]}>
        <StatusActions id={w.id} status={w.status} />
      </SectionCard>

      {w.customerEmailMissing && (
        <div role="alert" className="flex gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle className="size-5 shrink-0" aria-hidden />
          <span>
            <strong className="font-semibold">El mail con el código no le llegó al cliente.</strong> Mandale el código{" "}
            <strong className="font-mono">{w.code}</strong> vos (por mail o WhatsApp): la ley pide informarlo dentro de
            las 24 horas.
          </span>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        {/* ----- Cliente ----- */}
        <SectionCard icon={User} title="Cliente" contentClassName="flex flex-col gap-3 text-sm">
          <p className="font-medium">{w.fullName}</p>
          <p className="flex flex-wrap items-center gap-1 text-muted-foreground">
            <Mail className="size-4" aria-hidden />
            <span className="break-all">{w.email}</span>
            <CopyButton text={w.email} label="Copiar el email" />
          </p>
          {w.order?.phone && (
            <p className="flex flex-wrap items-center gap-1 text-muted-foreground">
              <Phone className="size-4" aria-hidden />
              <span className="tabular-nums">{w.order.phone}</span>
              <CopyButton text={w.order.phone} label="Copiar el teléfono" />
            </p>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            <a href={mailto} className={buttonVariants({ variant: "outline", size: "sm" })}>
              <Mail aria-hidden /> Escribirle por mail
            </a>
            {whatsappUrl && (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                <MessageCircle aria-hidden /> WhatsApp
              </a>
            )}
          </div>
        </SectionCard>

        {/* ----- Solicitud ----- */}
        <SectionCard icon={ClipboardList} title="Solicitud" contentClassName="flex flex-col gap-3 text-sm">
          <Detail label="Pedido">
            {w.order && w.orderId ? (
              <Link href={`/admin/pedidos/${w.orderId}`} className="font-medium text-brand underline underline-offset-4">
                #{w.order.number} · {formatARS(w.order.total)} · {formatArgentinaDateTime(w.order.createdAt)}
              </Link>
            ) : w.orderNumber ? (
              <span>
                #{w.orderNumber}{" "}
                <span className="text-amber-800">
                  (no coincide con el email de ningún pedido: buscalo en{" "}
                  <Link href={`/admin/pedidos?estado=todos&q=${w.orderNumber}`} className="underline underline-offset-4">
                    Pedidos
                  </Link>
                  )
                </span>
              </span>
            ) : (
              <span className="text-muted-foreground">No lo indicó: buscalo por el nombre o el email en Pedidos.</span>
            )}
          </Detail>
          <Detail label="Motivo">
            {w.reason ? (
              <span className="whitespace-pre-line">{w.reason}</span>
            ) : (
              <span className="text-muted-foreground">No indicó un motivo (no es obligatorio).</span>
            )}
          </Detail>
          <Detail label="Mail con el código al cliente">
            {w.customerEmailSentAt ? (
              <span className="text-emerald-700">Enviado el {formatArgentinaDateTime(w.customerEmailSentAt)}</span>
            ) : (
              <span className="text-amber-800">No salió (el cliente igual vio el código en pantalla).</span>
            )}
          </Detail>
        </SectionCard>
      </div>

      {/* ----- Gestión ----- */}
      {(w.handledAt || w.adminNote) && (
        <SectionCard icon={StickyNote} title="Gestión" contentClassName="flex flex-col gap-3 text-sm">
          {w.handledAt && (
            <Detail label="Último cambio">
              {STATUS_LABELS[w.status]} · {formatArgentinaDateTime(w.handledAt)}
              {w.handledByName ? ` · ${w.handledByName}` : ""}
            </Detail>
          )}
          {w.adminNote && (
            <Detail label="Nota">
              <span className="whitespace-pre-line">{w.adminNote}</span>
            </Detail>
          )}
        </SectionCard>
      )}
    </div>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</span>
      <span>{children}</span>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <Skeleton className="h-5 w-32" />
      <Skeleton className="h-9 w-64" />
      <Skeleton className="h-32 w-full rounded-xl" />
      <div className="grid gap-5 lg:grid-cols-2">
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    </div>
  );
}
