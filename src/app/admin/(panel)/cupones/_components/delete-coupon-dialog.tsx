"use client";

import { useTransition } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
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
import { deleteCoupon } from "../actions";
import type { Coupon } from "../types";

/**
 * Confirmación antes de eliminar. Solo se ofrece para cupones que nunca se
 * usaron (la base también lo controla: uno usado solo se puede pausar).
 */
export function DeleteCouponDialog({
  coupon,
  open,
  onOpenChange,
}: {
  /** Se conserva al cerrar, para la animación. */
  coupon: Coupon | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    if (!coupon) return;
    startTransition(async () => {
      try {
        const result = await deleteCoupon(coupon.id);
        if (result.ok) toast.success(`Cupón ${coupon.code} eliminado`);
        else toast.error(result.error);
        onOpenChange(false);
      } catch {
        toast.error("No se pudo eliminar. Revisá tu conexión e intentá de nuevo.");
      }
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-destructive/10">
            <Trash2 className="text-destructive" />
          </AlertDialogMedia>
          <AlertDialogTitle>¿Eliminar el cupón {coupon?.code}?</AlertDialogTitle>
          <AlertDialogDescription>
            Todavía no se usó en ninguna compra. Se borra definitivamente y el código deja de funcionar. Si solo querés
            frenarlo por un tiempo, mejor pausalo.
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
      </AlertDialogContent>
    </AlertDialog>
  );
}
