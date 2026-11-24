"use client";

import { Suspense, use, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { addToLabelQueue, getVariantsForLabels } from "../actions";
import { MAX_PER_VARIANT, type LabelVariantChoice } from "../types";
import { QuantityStepper } from "./quantity-stepper";

type Request = {
  /** Texto debajo del título (ej.: el nombre del producto o "3 productos"). */
  subtitle: string;
  /** Si viene, solo esa variante arranca tildada. */
  variantId?: string;
  variants: Promise<LabelVariantChoice[]>;
  /** Para que el formulario arranque limpio cada vez que se abre. */
  key: number;
};

/**
 * Hook para abrir "Agregar a etiquetas" desde cualquier pantalla:
 *
 *   const labels = useAddLabelsDialog();
 *   <button onClick={() => labels.openFor([productId], "Taza", variantId)}>Etiquetas</button>
 *   {labels.dialog}
 *
 * Al abrir pide a la base el stock ACTUAL de cada variante: esa es la
 * cantidad sugerida (una etiqueta por unidad), y se puede cambiar.
 */
export function useAddLabelsDialog() {
  const [request, setRequest] = useState<Request | null>(null);
  const [open, setOpen] = useState(false);

  function openFor(productIds: string[], subtitle: string, variantId?: string) {
    setRequest({ subtitle, variantId, variants: getVariantsForLabels(productIds), key: Date.now() });
    setOpen(true);
  }

  const dialog = (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Agregar a etiquetas</DialogTitle>
          <DialogDescription>{request?.subtitle}</DialogDescription>
        </DialogHeader>
        {request && (
          <Suspense fallback={<ListSkeleton />}>
            <AddForm key={request.key} request={request} onDone={() => setOpen(false)} />
          </Suspense>
        )}
      </DialogContent>
    </Dialog>
  );

  return { openFor, dialog };
}

type Row = { checked: boolean; quantity: string };

function AddForm({ request, onDone }: { request: Request; onDone: () => void }) {
  const variants = use(request.variants);
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // Cantidad sugerida = stock actual. Sin stock: destildada y en 1
  // (salvo que se haya pedido justo esa variante).
  const [rows, setRows] = useState<Record<string, Row>>(() =>
    Object.fromEntries(
      variants.map((v) => {
        const wanted = request.variantId ? v.variantId === request.variantId : v.stock > 0;
        return [v.variantId, { checked: wanted, quantity: String(Math.min(MAX_PER_VARIANT, Math.max(1, v.stock))) }];
      }),
    ),
  );

  if (variants.length === 0) {
    return (
      <p className="rounded-lg bg-muted px-3 py-3 text-sm text-muted-foreground">
        No hay variantes para imprimir: los productos archivados no llevan etiquetas. Desarchivalos primero.
      </p>
    );
  }

  const chosen = variants.filter((v) => rows[v.variantId]?.checked);
  const total = chosen.reduce((s, v) => s + (Number(rows[v.variantId].quantity) || 0), 0);
  const allChecked = chosen.length === variants.length;
  const multipleProducts = new Set(variants.map((v) => v.productId)).size > 1;

  const update = (id: string, patch: Partial<Row>) => setRows((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  function submit() {
    const items = chosen.map((v) => ({ variantId: v.variantId, quantity: Math.max(1, Number(rows[v.variantId].quantity) || 1) }));
    if (items.length === 0) return;
    startTransition(async () => {
      try {
        const result = await addToLabelQueue(items);
        if (result.ok) {
          toast.success(result.message, {
            action: { label: "Ver etiquetas", onClick: () => router.push("/admin/etiquetas") },
          });
          onDone();
        } else {
          toast.error(result.error);
        }
      } catch {
        toast.error("No se pudo agregar a la cola. Revisá tu conexión e intentá de nuevo.");
      }
    });
  }

  return (
    <form
      className="flex min-h-0 flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      {variants.length > 1 && (
        <label className="flex items-center gap-2.5 text-sm text-muted-foreground">
          <Checkbox
            checked={allChecked}
            indeterminate={chosen.length > 0 && !allChecked}
            onCheckedChange={(checked) =>
              setRows((prev) =>
                Object.fromEntries(Object.entries(prev).map(([id, r]) => [id, { ...r, checked: Boolean(checked) }])),
              )
            }
          />
          Todas las variantes
        </label>
      )}

      <ul className="-mx-4 min-h-0 flex-1 divide-y overflow-y-auto border-y">
        {variants.map((v, i) => {
          const row = rows[v.variantId];
          const name = v.variantLabel ?? (multipleProducts ? v.productName : "Única");
          const showProduct = multipleProducts && v.variantLabel && variants[i - 1]?.productId !== v.productId;
          return (
            <li key={v.variantId} className="flex flex-col">
              {showProduct && (
                <span className="bg-muted/50 px-4 pt-2 pb-1 text-xs font-semibold text-muted-foreground">{v.productName}</span>
              )}
              <div className={cn("flex items-center gap-3 px-4 py-2.5", !row.checked && "text-muted-foreground")}>
                <label className="flex min-w-0 flex-1 items-center gap-3">
                  <Checkbox checked={row.checked} onCheckedChange={(checked) => update(v.variantId, { checked: Boolean(checked) })} />
                  <span className="flex min-w-0 flex-col">
                    <span className={cn("truncate text-sm", row.checked && "font-medium text-foreground")}>{name}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      Stock {v.stock}
                      {v.queued > 0 && <span className="text-brand"> · ya en la cola: {v.queued}</span>}
                    </span>
                  </span>
                </label>
                <QuantityStepper
                  value={row.quantity}
                  onChange={(quantity) => update(v.variantId, { quantity, checked: true })}
                  label={`Cantidad de etiquetas de ${v.productName} ${v.variantLabel ?? ""}`.trim()}
                />
              </div>
            </li>
          );
        })}
      </ul>

      {chosen.some((v) => v.queued > 0) && (
        <p className="text-xs text-muted-foreground">
          Las que ya están en la cola se reemplazan por la cantidad nueva (no se suman).
        </p>
      )}

      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" disabled={pending} />}>Cancelar</DialogClose>
        <Button type="submit" disabled={pending || total === 0}>
          {pending && <Loader2 className="animate-spin" />}
          {total === 0 ? "Elegí al menos una" : total === 1 ? "Agregar 1 etiqueta" : `Agregar ${total} etiquetas`}
        </Button>
      </DialogFooter>
    </form>
  );
}

function ListSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-busy aria-label="Cargando las variantes">
      {Array.from({ length: 3 }, (_, i) => (
        <Skeleton key={i} className="h-11 w-full" />
      ))}
    </div>
  );
}
