"use client";

import { useState, useTransition } from "react";
import { Ban, CircleCheck, Hourglass, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { setWithdrawalStatus } from "../../actions";
import type { WithdrawalStatus } from "../../status";

type Target = "in_progress" | "resolved" | "rejected";

const DIALOGS: Record<
  Target,
  { title: string; description: string; confirm: string; noteLabel: string; placeholder: string; noteRequired: boolean }
> = {
  in_progress: {
    title: "¿Marcar como «En gestión»?",
    description: "Usalo cuando ya contactaste al cliente y están coordinando la devolución del producto.",
    confirm: "Sí, en gestión",
    noteLabel: "Nota (opcional)",
    placeholder: "Ej.: Le escribí por WhatsApp; trae el producto el martes.",
    noteRequired: false,
  },
  resolved: {
    title: "¿Marcar como «Resuelta»?",
    description:
      "Usalo cuando el producto volvió y ya le devolviste el dinero desde Mercado Pago (Actividad → el pago → Devolver dinero).",
    confirm: "Sí, resuelta",
    noteLabel: "Nota (opcional)",
    placeholder: "Ej.: Producto recibido el 2/12, dinero devuelto por Mercado Pago.",
    noteRequired: false,
  },
  rejected: {
    title: "¿Marcar como «No corresponde»?",
    description:
      "Por ejemplo, si pasaron más de 10 días desde que recibió el producto o el producto ya se usó. Contale al cliente el motivo antes de marcarla.",
    confirm: "Sí, no corresponde",
    noteLabel: "Motivo (obligatorio)",
    placeholder: "Ej.: Pasaron 25 días desde la entrega. Se lo expliqué por mail.",
    noteRequired: true,
  },
};

/** Botones de estado de una solicitud, cada uno con su confirmación (y nota). */
export function StatusActions({ id, status }: { id: string; status: WithdrawalStatus }) {
  const [target, setTarget] = useState<Target | null>(null);
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const dialog = target ? DIALOGS[target] : null;

  function open(t: Target) {
    setNote("");
    setTarget(t);
  }

  function confirm() {
    if (!target) return;
    if (DIALOGS[target].noteRequired && note.trim() === "") {
      toast.error("Escribí el motivo: le sirve a quien la mire después.");
      return;
    }
    startTransition(async () => {
      try {
        const result = await setWithdrawalStatus(id, target, note);
        if (result.ok) {
          toast.success(result.message);
          setTarget(null);
        } else toast.error(result.error);
      } catch {
        toast.error("No se pudo guardar. Revisá tu conexión e intentá de nuevo.");
      }
    });
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {status === "new" && (
          <Button onClick={() => open("in_progress")}>
            <Hourglass /> Marcar en gestión
          </Button>
        )}
        {status === "in_progress" && (
          <Button onClick={() => open("resolved")}>
            <CircleCheck /> Marcar resuelta
          </Button>
        )}
        {status === "new" && (
          <Button variant="outline" onClick={() => open("resolved")}>
            <CircleCheck /> Marcar resuelta
          </Button>
        )}
        {(status === "new" || status === "in_progress") && (
          <Button variant="outline" onClick={() => open("rejected")}>
            <Ban /> No corresponde
          </Button>
        )}
        {(status === "resolved" || status === "rejected") && (
          <Button variant="outline" onClick={() => open("in_progress")}>
            <RotateCcw /> Volver a «En gestión»
          </Button>
        )}
      </div>

      <AlertDialog open={target !== null} onOpenChange={(o) => !o && setTarget(null)}>
        <AlertDialogContent>
          {dialog && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>{dialog.title}</AlertDialogTitle>
                <AlertDialogDescription>{dialog.description}</AlertDialogDescription>
              </AlertDialogHeader>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`withdrawal-note-${id}`}>{dialog.noteLabel}</Label>
                <Textarea
                  id={`withdrawal-note-${id}`}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={1000}
                  rows={3}
                  placeholder={dialog.placeholder}
                />
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={pending}>Volver</AlertDialogCancel>
                <AlertDialogAction disabled={pending} onClick={confirm}>
                  {pending && <Loader2 className="animate-spin" />}
                  {dialog.confirm}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
