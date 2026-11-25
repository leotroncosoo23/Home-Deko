"use client";

import { useState, useTransition } from "react";
import { Ban, Loader2 } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cancelOrder } from "../../actions";

/**
 * "Cancelar pedido": botón con borde + confirmación. El stock vuelve solo
 * (la base lo devuelve una sola vez); el DINERO no: se devuelve desde el
 * portal del medio de pago (Getnet o Mercado Pago), y el diálogo lo aclara.
 */
export function CancelOrderButton({
  orderId,
  number,
  stockReturns,
  refundHow,
}: {
  orderId: string;
  number: number;
  /** false = el stock nunca se descontó (ej.: pagado sin stock). */
  stockReturns: boolean;
  /** "desde el portal de Getnet (…)" — sale de paymentCopy() en el servidor. */
  refundHow: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      try {
        const result = await cancelOrder(orderId, reason);
        if (result.ok) {
          toast.success(result.message);
          setOpen(false);
        } else toast.error(result.error);
      } catch {
        toast.error("No se pudo cancelar. Revisá tu conexión e intentá de nuevo.");
      }
    });
  }

  return (
    <>
      <div>
        <Button variant="outline" className="bg-background text-destructive hover:text-destructive" onClick={() => setOpen(true)}>
          <Ban /> Cancelar pedido
        </Button>
      </div>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-destructive/10">
              <Ban className="text-destructive" />
            </AlertDialogMedia>
            <AlertDialogTitle>¿Cancelar el pedido #{number}?</AlertDialogTitle>
            <AlertDialogDescription>
              {stockReturns ? "Los productos vuelven al stock solos. " : ""}
              <strong className="font-medium text-foreground">El dinero no se devuelve solo:</strong> si el cliente pagó,
              hacé la devolución {refundHow}. Esto no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`cancel-reason-${orderId}`}>
              Motivo <span className="font-normal text-muted-foreground">(opcional, queda en el historial)</span>
            </Label>
            <Textarea
              id={`cancel-reason-${orderId}`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={300}
              rows={2}
              placeholder="Ej.: El cliente se arrepintió."
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Volver</AlertDialogCancel>
            <AlertDialogAction variant="outline" className="text-destructive" disabled={pending} onClick={confirm}>
              {pending ? <Loader2 className="animate-spin" /> : <Ban />}
              Sí, cancelar el pedido
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
