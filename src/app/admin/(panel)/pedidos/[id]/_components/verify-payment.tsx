"use client";

import { useState } from "react";
import { SearchCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CopyButton } from "./copy-button";

/**
 * "Verificar pago" (Getnet). La doc oficial de Getnet Web Checkout no
 * publica una consulta de estado (A CONFIRMAR con Getnet): por eso el botón
 * muestra el código del pago para buscarlo a mano en el portal. Si Getnet
 * confirma un endpoint de consulta, se suma en src/lib/payments/getnet.ts y
 * este botón pasa a consultarlo.
 */
export function VerifyPaymentButton({ intentId, paymentId }: { intentId: string; paymentId: string | null }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => setOpen(true)}>
        <SearchCheck className="size-4" aria-hidden />
        Verificar pago
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Verificar el pago en Getnet</DialogTitle>
            <DialogDescription>
              Entrá al portal de Getnet y buscá la operación con este código. Ahí ves si el pago se aprobó, se rechazó o
              quedó sin terminar.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 text-sm">
            <div className="flex flex-col gap-1 rounded-lg border bg-muted/40 p-3">
              <span className="text-xs font-medium text-muted-foreground">Código del pago (payment intent)</span>
              <span className="flex items-center justify-between gap-2">
                <span className="font-mono break-all">{intentId}</span>
                <CopyButton text={intentId} label="Copiar el código del pago" />
              </span>
            </div>
            {paymentId && (
              <div className="flex flex-col gap-1 rounded-lg border bg-muted/40 p-3">
                <span className="text-xs font-medium text-muted-foreground">N.º de operación</span>
                <span className="flex items-center justify-between gap-2">
                  <span className="font-mono break-all">{paymentId}</span>
                  <CopyButton text={paymentId} label="Copiar el número de operación" />
                </span>
              </div>
            )}
            <p className="text-muted-foreground">
              Si en Getnet el pago figura aprobado por el total del pedido y acá sigue esperando, puede que el aviso de
              Getnet no haya llegado: no lo despaches hasta resolverlo con quien administra la tienda online.
            </p>
          </div>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cerrar</DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
