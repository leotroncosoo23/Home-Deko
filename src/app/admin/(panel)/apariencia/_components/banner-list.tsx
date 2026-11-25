"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronDown, ChevronUp, Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { formatArgentinaDay } from "@/lib/dates";
import { deleteBanner, moveBanner, setBannerActive } from "../actions";
import { BANNER_STATUS_LABELS, type AdminBanner, type BannerStatus } from "../types";

/**
 * Lista de banners en el orden del carrusel: número, subir/bajar, miniatura,
 * fechas, estado, "Activo", editar y eliminar.
 */
export function BannerList({ banners }: { banners: AdminBanner[] }) {
  // El banner a eliminar se conserva al cerrar el diálogo (para la animación).
  const [toDelete, setToDelete] = useState<AdminBanner | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  // Un solo movimiento a la vez (mientras tanto, todas las flechas quietas).
  const [moving, startMoving] = useTransition();

  function move(b: AdminBanner, direction: "up" | "down") {
    startMoving(async () => {
      try {
        const result = await moveBanner(b.id, direction);
        if (!result.ok) toast.error(result.error);
      } catch {
        toast.error("No se pudo guardar. Revisá tu conexión e intentá de nuevo.");
      }
    });
  }

  return (
    <>
      <ol className="flex flex-col divide-y overflow-hidden surface-card">
        {banners.map((b, i) => (
          <BannerRow
            key={b.id}
            banner={b}
            number={i + 1}
            canMoveUp={i > 0}
            canMoveDown={i < banners.length - 1}
            moving={moving}
            onMove={(direction) => move(b, direction)}
            onDelete={() => {
              setToDelete(b);
              setDeleteOpen(true);
            }}
          />
        ))}
      </ol>
      <DeleteBannerDialog banner={toDelete} open={deleteOpen} onOpenChange={setDeleteOpen} />
    </>
  );
}

function BannerRow({
  banner: b,
  number,
  canMoveUp,
  canMoveDown,
  moving,
  onMove,
  onDelete,
}: {
  banner: AdminBanner;
  number: number;
  canMoveUp: boolean;
  canMoveDown: boolean;
  moving: boolean;
  onMove: (direction: "up" | "down") => void;
  onDelete: () => void;
}) {
  const [pending, startTransition] = useTransition();

  function toggleActive(isActive: boolean) {
    startTransition(async () => {
      try {
        const result = await setBannerActive(b.id, isActive);
        if (result.ok) toast.success(isActive ? "Banner activado" : "Banner pausado");
        else toast.error(result.error);
      } catch {
        toast.error("No se pudo guardar. Revisá tu conexión e intentá de nuevo.");
      }
    });
  }

  const arrow = cn(buttonVariants({ variant: "ghost", size: "icon-xs" }), "text-muted-foreground");

  return (
    <li className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4">
      <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
        {/* Orden: número + subir/bajar */}
        <div className="flex shrink-0 flex-col items-center">
          <button
            type="button"
            onClick={() => onMove("up")}
            disabled={!canMoveUp || moving}
            aria-label={`Subir «${b.title}» (pasa a ser el banner ${number - 1})`}
            className={arrow}
          >
            <ChevronUp />
          </button>
          <span className="text-sm font-semibold tabular-nums">
            <span className="sr-only">Banner </span>
            {number}
          </span>
          <button
            type="button"
            onClick={() => onMove("down")}
            disabled={!canMoveDown || moving}
            aria-label={`Bajar «${b.title}» (pasa a ser el banner ${number + 1})`}
            className={arrow}
          >
            <ChevronDown />
          </button>
        </div>
        <Thumbnail banner={b} />
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/admin/apariencia/banner/${b.id}`} className="truncate font-medium hover:underline">
              {b.title}
            </Link>
            <StatusBadge status={b.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            {b.kind === "template" ? "Plantilla" : "Imagen completa"} · {datesText(b)}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 sm:justify-end">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          <Switch
            checked={b.isActive}
            onCheckedChange={toggleActive}
            disabled={pending}
            aria-label={`Activo: ${b.title}`}
          />
          Activo
        </label>
        <div className="flex items-center gap-1">
          <Link href={`/admin/apariencia/banner/${b.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
            <Pencil /> Editar
          </Link>
          <button
            type="button"
            onClick={onDelete}
            aria-label={`Eliminar ${b.title}`}
            className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }), "text-muted-foreground hover:text-destructive")}
          >
            <Trash2 />
          </button>
        </div>
      </div>
    </li>
  );
}

/** Miniatura: la foto o imagen del banner, o un recuadro con su color de fondo. */
function Thumbnail({ banner: b }: { banner: AdminBanner }) {
  const src = b.kind === "image" ? b.imageUrl : b.productImageUrl;
  return (
    <div
      className={cn(
        "relative h-14 w-24 shrink-0 overflow-hidden rounded-md border",
        b.background === "red" && b.kind === "template" ? "bg-brand" : "bg-muted",
      )}
    >
      {src && <Image src={src} alt="" fill sizes="96px" className="object-cover" />}
    </div>
  );
}

/** Colores del CLAUDE.md: verde = se ve, ámbar = programado, gris = terminado/pausado. */
function StatusBadge({ status }: { status: BannerStatus }) {
  if (status === "live") {
    return <Badge className="bg-emerald-50 text-emerald-700">{BANNER_STATUS_LABELS.live}</Badge>;
  }
  if (status === "scheduled") {
    return <Badge className="bg-amber-50 text-amber-700">{BANNER_STATUS_LABELS.scheduled}</Badge>;
  }
  return (
    <Badge variant="secondary" className="text-muted-foreground">
      {BANNER_STATUS_LABELS[status]}
    </Badge>
  );
}

function datesText(b: AdminBanner): string {
  if (b.startsOn && b.endsOn) return `Del ${formatArgentinaDay(b.startsOn)} al ${formatArgentinaDay(b.endsOn)}`;
  if (b.startsOn) return `Desde el ${formatArgentinaDay(b.startsOn)}, sin fecha de fin`;
  if (b.endsOn) return `Hasta el ${formatArgentinaDay(b.endsOn)}`;
  return "Sin fechas";
}

// ---------------------------------------------------------------------------

function DeleteBannerDialog({
  banner,
  open,
  onOpenChange,
}: {
  banner: AdminBanner | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    if (!banner) return;
    startTransition(async () => {
      try {
        const result = await deleteBanner(banner.id);
        if (result.ok) {
          toast.success("Banner eliminado");
          onOpenChange(false);
        } else {
          toast.error(result.error);
        }
      } catch {
        toast.error("No se pudo eliminar. Revisá tu conexión e intentá de nuevo.");
      }
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        {banner && (
          <>
            <AlertDialogHeader>
              <AlertDialogMedia className="bg-destructive/10">
                <Trash2 className="text-destructive" />
              </AlertDialogMedia>
              <AlertDialogTitle>¿Eliminar «{banner.title}»?</AlertDialogTitle>
              <AlertDialogDescription>
                El banner se borra definitivamente, junto con sus imágenes. Esto no se puede
                deshacer. Si solo querés sacarlo de la tienda por un tiempo, apagá «Activo».
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
              {/* Acción destructiva: botón con borde rojo (ver CLAUDE.md) */}
              <AlertDialogAction
                variant="outline"
                onClick={handleDelete}
                disabled={pending}
                className="border-destructive/40 text-destructive hover:bg-destructive/5 hover:text-destructive"
              >
                {pending ? <Loader2 className="animate-spin" /> : <Trash2 />}
                {pending ? "Eliminando…" : "Eliminar"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
