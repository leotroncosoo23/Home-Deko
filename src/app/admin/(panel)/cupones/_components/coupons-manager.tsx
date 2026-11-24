"use client";

import { useOptimistic, useState, useTransition } from "react";
import { Copy, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import {
  COUPON_STATUS_LABEL,
  couponValueLabel,
  formatDay,
  shortARS,
  type CouponStatus,
} from "@/lib/coupons";
import { formatARS } from "@/lib/format";
import { setCouponActive } from "../actions";
import type { Coupon } from "../types";
import { CouponDialog } from "./coupon-dialog";
import { DeleteCouponDialog } from "./delete-coupon-dialog";

/** Hoy en Argentina, "AAAA-MM-DD" (para recalcular el estado al pausar/activar). */
function todayAR(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date());
}

/** Misma regla que la vista admin_coupons de la base. */
function statusOf(c: Coupon): CouponStatus {
  const today = todayAR();
  if (!c.isActive) return "paused";
  if (c.endsOn && c.endsOn < today) return "expired";
  if (c.maxUses !== null && c.uses >= c.maxUses) return "exhausted";
  if (c.startsOn && c.startsOn > today) return "scheduled";
  return "active";
}

/**
 * Lista de cupones: tabla en PC, tarjetas en el celular.
 * Pausar / activar es "optimista": el interruptor cambia al instante y, si
 * el servidor falla, vuelve solo a como estaba.
 */
export function CouponsManager({ coupons }: { coupons: Coupon[] }) {
  const [items, setOptimisticItems] = useOptimistic(coupons);
  const [, startTransition] = useTransition();

  const [editing, setEditing] = useState<Coupon | undefined>(undefined);
  const [editOpen, setEditOpen] = useState(false);
  const [deleting, setDeleting] = useState<Coupon | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  function handleToggle(coupon: Coupon, active: boolean) {
    startTransition(async () => {
      setOptimisticItems((list) =>
        list.map((c) => (c.id === coupon.id ? { ...c, isActive: active, status: statusOf({ ...c, isActive: active }) } : c)),
      );
      try {
        const result = await setCouponActive(coupon.id, active);
        if (result.ok) toast.success(active ? `${coupon.code} está activo` : `${coupon.code} quedó pausado`);
        else toast.error(result.error);
      } catch {
        toast.error("No se pudo guardar. Revisá tu conexión.");
      }
    });
  }

  async function handleCopy(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      toast.success(`Código ${code} copiado`);
    } catch {
      toast.error("No se pudo copiar. Seleccioná el código y copialo a mano.");
    }
  }

  const actions = (coupon: Coupon) => ({
    onEdit: () => {
      setEditing(coupon);
      setEditOpen(true);
    },
    onToggle: (active: boolean) => handleToggle(coupon, active),
    onCopy: () => void handleCopy(coupon.code),
    onDelete: () => {
      setDeleting(coupon);
      setDeleteOpen(true);
    },
  });

  return (
    <>
      <div className="overflow-hidden surface-card">
        {/* Encabezado de columnas (desde tablet) */}
        <div className="hidden grid-cols-[minmax(0,1fr)_7rem_6rem_8rem_4.5rem_2.5rem] items-center gap-3 border-b bg-muted/40 px-4 py-2 text-xs font-medium text-muted-foreground md:grid">
          <span>Cupón</span>
          <span>Estado</span>
          <span className="text-right">Usos</span>
          <span className="text-right">Descontado</span>
          <span className="text-center">Activo</span>
          <span />
        </div>
        <ul className="divide-y">
          {items.map((coupon) => (
            <CouponRow key={coupon.id} coupon={coupon} {...actions(coupon)} />
          ))}
        </ul>
      </div>

      <CouponDialog open={editOpen} onOpenChange={setEditOpen} coupon={editing} />
      <DeleteCouponDialog coupon={deleting} open={deleteOpen} onOpenChange={setDeleteOpen} />
    </>
  );
}

function CouponRow({
  coupon,
  onEdit,
  onToggle,
  onCopy,
  onDelete,
}: {
  coupon: Coupon;
  onEdit: () => void;
  onToggle: (active: boolean) => void;
  onCopy: () => void;
  onDelete: () => void;
}) {
  const uses = coupon.maxUses ? `${coupon.uses} de ${coupon.maxUses}` : String(coupon.uses);
  const details = [
    coupon.kind === "free_shipping" ? "Envío gratis" : `${couponValueLabel(coupon.kind, coupon.value)} de descuento`,
    coupon.minPurchase ? `desde ${shortARS(coupon.minPurchase)}` : null,
    coupon.onePerCustomer ? "1 por cliente" : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const dates =
    coupon.startsOn && coupon.endsOn
      ? `Del ${formatDay(coupon.startsOn)} al ${formatDay(coupon.endsOn)}`
      : coupon.startsOn
        ? `Desde el ${formatDay(coupon.startsOn)}`
        : coupon.endsOn
          ? `Hasta el ${formatDay(coupon.endsOn)}`
          : "Sin fecha de vencimiento";

  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-4 py-3 md:grid-cols-[minmax(0,1fr)_7rem_6rem_8rem_4.5rem_2.5rem]">
      {/* Código y qué hace */}
      <div className="flex min-w-0 flex-col gap-0.5">
        <button
          type="button"
          onClick={onEdit}
          className="self-start truncate font-mono text-[15px] font-semibold tracking-wide hover:underline focus-visible:underline focus-visible:outline-none"
        >
          {coupon.code}
        </button>
        <span className="truncate text-sm text-muted-foreground">{details}</span>
        <span className="text-xs text-muted-foreground">{dates}</span>
        {coupon.overLimitUses > 0 && (
          <span className="text-xs text-amber-700">
            {coupon.overLimitUses === 1
              ? "1 uso entró por encima del límite (dos pagos casi a la vez): se respetó."
              : `${coupon.overLimitUses} usos entraron por encima del límite (pagos casi a la vez): se respetaron.`}
          </span>
        )}
        {/* En el celular: estado, usos y descontado acá abajo */}
        <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground md:hidden">
          <StatusBadge status={coupon.status} />
          <span className="tabular-nums">Usos: {uses}</span>
          <span className="tabular-nums">Descontado: {formatARS(coupon.totalDiscount)}</span>
        </span>
      </div>

      <span className="hidden md:block">
        <StatusBadge status={coupon.status} />
      </span>
      <span className="hidden text-right text-sm tabular-nums md:block">{uses}</span>
      <span className="hidden text-right text-sm tabular-nums md:block">{formatARS(coupon.totalDiscount)}</span>

      {/* Activo + menú (en el celular, a la derecha de todo) */}
      <div className="flex items-center gap-1 md:contents">
        <span className="flex justify-center">
          <Switch
            checked={coupon.isActive}
            onCheckedChange={onToggle}
            aria-label={coupon.isActive ? `Pausar ${coupon.code}` : `Activar ${coupon.code}`}
          />
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label={`Acciones de ${coupon.code}`} />}>
            <MoreHorizontal />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={onEdit}>
              <Pencil /> Editar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onCopy}>
              <Copy /> Copiar código
            </DropdownMenuItem>
            {/* Un cupón usado no se borra (solo se pausa) */}
            {!coupon.everUsed && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={onDelete}>
                  <Trash2 /> Eliminar
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  );
}

/** Verde activo · gris programado/pausado/vencido · ámbar agotado (colores del CLAUDE.md). */
function StatusBadge({ status }: { status: CouponStatus }) {
  const label = COUPON_STATUS_LABEL[status];
  if (status === "active") return <Badge className="bg-emerald-50 text-emerald-700">{label}</Badge>;
  if (status === "exhausted") return <Badge className="bg-amber-50 text-amber-800">{label}</Badge>;
  return (
    <Badge variant="secondary" className="text-muted-foreground">
      {label}
    </Badge>
  );
}
