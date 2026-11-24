"use client";

import { useState, useTransition } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteMyAccount } from "@/app/(tienda)/mi-cuenta/actions";
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
import { forgetSavedCustomer } from "../checkout/checkout-storage";

/**
 * "Eliminar mi cuenta" (Ley 25.326, derecho de supresión). Botón con borde
 * + confirmación que explica qué se borra y qué se conserva.
 */
export function DeleteAccount() {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      const result = await deleteMyAccount().catch(() => null);
      if (!result) {
        toast.error("No pudimos eliminar tu cuenta. Revisá tu conexión e intentá de nuevo.");
        return;
      }
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      // Tampoco quedan datos personales guardados en este navegador.
      // (El carrito sí se conserva: no tiene datos personales.)
      forgetSavedCustomer();
      // Navegación COMPLETA a propósito (no router.push): la sesión ya no
      // existe y así todo (encabezado incluido) se arma de cero, sin cuenta.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/mi-cuenta?eliminada=1");
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-11 items-center justify-center gap-2 self-start rounded-full border border-destructive/40 px-5 text-[15px] font-semibold text-destructive transition-colors hover:bg-destructive/5 focus-visible:ring-3 focus-visible:ring-destructive/20 focus-visible:outline-none"
      >
        <Trash2 aria-hidden className="size-4" />
        Eliminar mi cuenta
      </button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-destructive/10">
              <Trash2 className="text-destructive" />
            </AlertDialogMedia>
            <AlertDialogTitle>¿Eliminar tu cuenta?</AlertDialogTitle>
            <AlertDialogDescription>
              Borramos tu nombre, tu teléfono, tu dirección guardada y tu acceso con este email. Los pedidos que ya
              hiciste los conservamos, sin vincularlos a ninguna cuenta, porque la ley nos obliga a guardar el registro
              de las ventas. Esto no se puede deshacer. Si más adelante volvés a ingresar, se crea una cuenta nueva.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Volver</AlertDialogCancel>
            <AlertDialogAction variant="outline" className="text-destructive" disabled={pending} onClick={confirm}>
              {pending ? <Loader2 className="animate-spin" /> : <Trash2 />}
              Sí, eliminar mi cuenta
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
