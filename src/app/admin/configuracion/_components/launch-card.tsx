"use client";

import { useId, useState, useTransition } from "react";
import { Hammer, Loader2, Rocket, Store } from "lucide-react";
import { toast } from "sonner";
import { SectionCard } from "@/components/admin/section-card";
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
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { setStoreLaunched } from "../actions";

/**
 * "Estado de la tienda": el interruptor del modo construcción.
 *
 * Prender o apagar cambia lo que ve TODO el mundo, así que siempre pide
 * confirmación. Se guarda apenas se confirma (no depende del botón
 * "Guardar cambios" del formulario de abajo).
 */
export function LaunchCard({ isLaunched }: { isLaunched: boolean }) {
  const id = useId();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const next = !isLaunched;

  function handleConfirm() {
    startTransition(async () => {
      try {
        const result = await setStoreLaunched(next);
        if (result.ok) {
          toast.success(next ? "¡La tienda está publicada!" : "La tienda volvió al modo construcción");
          setConfirmOpen(false);
        } else {
          toast.error(result.error);
        }
      } catch {
        toast.error("No se pudo guardar. Revisá tu conexión e intentá de nuevo.");
      }
    });
  }

  return (
    <SectionCard
      icon={Store}
      title="Estado de la tienda"
      description="Mientras no esté lanzada, los visitantes ven la página «Muy pronto»."
      action={
        isLaunched ? (
          <Badge className="bg-emerald-50 text-emerald-700">Publicada</Badge>
        ) : (
          <Badge variant="secondary" className="text-muted-foreground">
            En construcción
          </Badge>
        )
      }
    >
      <div className="flex items-center justify-between gap-4 rounded-lg border px-3 py-2.5">
        <div className="flex flex-col gap-0.5">
          <Label htmlFor={id}>Tienda lanzada</Label>
          <p className="text-xs text-muted-foreground">
            {isLaunched
              ? "Todos pueden ver la tienda y comprar."
              : "Solo ustedes (los administradores) ven la tienda, con una barra de «Vista previa» arriba."}
          </p>
        </div>
        <Switch
          id={id}
          checked={isLaunched}
          // No cambia solo: abre la confirmación y cambia recién al confirmar.
          onCheckedChange={() => setConfirmOpen(true)}
          disabled={pending}
        />
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={(open) => !pending && setConfirmOpen(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className={next ? "bg-emerald-50" : undefined}>
              {next ? <Rocket className="text-emerald-700" /> : <Hammer className="text-muted-foreground" />}
            </AlertDialogMedia>
            <AlertDialogTitle>{next ? "¿Lanzar la tienda?" : "¿Volver al modo construcción?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {next
                ? "Desde ahora, cualquier persona que entre al sitio va a ver la tienda y va a poder comprar. Los buscadores también van a poder mostrarla."
                : "Los visitantes van a ver de nuevo la página «Muy pronto» y no van a poder comprar. Ustedes van a seguir viendo la tienda."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm} disabled={pending}>
              {pending && <Loader2 className="animate-spin" />}
              {next ? "Sí, lanzar la tienda" : "Sí, volver a construcción"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SectionCard>
  );
}
