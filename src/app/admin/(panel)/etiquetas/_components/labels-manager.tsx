"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Eye, FileStack, Loader2, Package, Tag, Trash2 } from "lucide-react";
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
import { Button, buttonVariants } from "@/components/ui/button";
import { buildSheets, computeGeometry, type LabelGroup } from "@/lib/labels/layout";
import { addToLabelQueue, clearLabelQueue, removeFromLabelQueue, setLabelQuantity } from "../actions";
import type { LabelQueueItem } from "../types";
import { PrintPreviewDialog } from "./print-preview";
import { QueueList } from "./queue-list";
import { SheetSettings } from "./sheet-settings";
import { useLabelSettings } from "./use-label-settings";

/** Espera antes de guardar una cantidad (para no guardar en cada tecla). */
const SAVE_DELAY = 600;

const plural = (n: number, one: string, many: string) => (n === 1 ? `1 ${one}` : `${n} ${many}`);

/**
 * Pantalla de Etiquetas: la cola (a la izquierda) y la hoja (a la derecha;
 * abajo en el celular).
 *
 * Los cambios se ven al instante ("optimistas") y se guardan en la base
 * por detrás. Si algo falla, vuelve a como estaba y avisa.
 */
export function LabelsManager({ items }: { items: LabelQueueItem[] }) {
  const [settings, setSettings] = useLabelSettings();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, startClear] = useTransition();

  // Cantidades que se están escribiendo (todavía no guardadas, o recién)
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  // Quitadas en pantalla mientras se confirman en la base
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  // useMemo: la vista previa vuelve a armar el PDF solo si esto cambia de verdad
  const visible = useMemo(() => items.filter((i) => !removed.has(i.variantId)), [items, removed]);
  const quantityOf = (item: LabelQueueItem) => drafts[item.variantId] ?? String(item.quantity);

  // Lo que va a la hoja: un grupo por variante, en el orden de la cola
  const groups: LabelGroup[] = useMemo(
    () =>
      visible.map((i) => ({
        productName: i.productName,
        variantLabel: i.variantLabel,
        barcode: i.barcode,
        quantity: Math.max(0, Number(drafts[i.variantId] ?? i.quantity) || 0),
      })),
    [visible, drafts],
  );
  const total = groups.reduce((s, g) => s + g.quantity, 0);
  // Para contar hojas no hace falta medir textos
  const sheetCount = useMemo(() => buildSheets(groups, settings, () => 0).pages.length, [groups, settings]);
  const geometry = computeGeometry(settings);
  const canPrint = total > 0 && !geometry.problem;

  // ----- Cambiar cantidad (se guarda solo, al dejar de escribir) -----------
  function handleQuantity(item: LabelQueueItem, value: string) {
    setDrafts((prev) => ({ ...prev, [item.variantId]: value }));
    clearTimeout(timers.current.get(item.variantId));
    const n = Number(value);
    if (!Number.isInteger(n) || n < 1) return; // vacío mientras escribe: no se guarda
    // Si falla, vuelve a mostrar la cantidad guardada
    const revert = () =>
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[item.variantId];
        return next;
      });
    timers.current.set(
      item.variantId,
      setTimeout(async () => {
        try {
          const result = await setLabelQuantity(item.variantId, n);
          if (!result.ok) {
            toast.error(result.error);
            revert();
          }
        } catch {
          toast.error("No se pudo guardar la cantidad. Revisá tu conexión.");
          revert();
        }
      }, SAVE_DELAY),
    );
  }

  // ----- Quitar (con "Deshacer") -------------------------------------------
  async function handleRemove(item: LabelQueueItem) {
    clearTimeout(timers.current.get(item.variantId));
    const quantity = Number(quantityOf(item)) || item.quantity;
    setRemoved((prev) => new Set(prev).add(item.variantId));
    const restore = () =>
      setRemoved((prev) => {
        const next = new Set(prev);
        next.delete(item.variantId);
        return next;
      });
    try {
      const result = await removeFromLabelQueue(item.variantId);
      if (!result.ok) {
        restore();
        toast.error(result.error);
        return;
      }
      toast.success(`${item.productName}${item.variantLabel ? ` · ${item.variantLabel}` : ""}: quitada de la cola`, {
        action: {
          label: "Deshacer",
          onClick: async () => {
            const undo = await addToLabelQueue([{ variantId: item.variantId, quantity }]);
            if (undo.ok) restore();
            else toast.error(undo.error);
          },
        },
      });
    } catch {
      restore();
      toast.error("No se pudo quitar. Revisá tu conexión e intentá de nuevo.");
    }
  }

  // ----- Vaciar --------------------------------------------------------------
  function handleClear() {
    startClear(async () => {
      try {
        const result = await clearLabelQueue();
        if (result.ok) {
          toast.success(result.message);
          setDrafts({});
          setConfirmClear(false);
        } else {
          toast.error(result.error);
        }
      } catch {
        toast.error("No se pudo vaciar la cola. Revisá tu conexión e intentá de nuevo.");
      }
    });
  }

  if (visible.length === 0) return <EmptyQueue />;

  const summary = `${plural(total, "etiqueta", "etiquetas")} · ${plural(sheetCount, "hoja", "hojas")}`;

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start">
        {/* ----- Cola ----- */}
        <SectionCard
          icon={Tag}
          title="Cola de impresión"
          description={`${summary} · ${plural(visible.length, "variante", "variantes")}`}
          action={
            <Button type="button" variant="outline" size="sm" onClick={() => setConfirmClear(true)}>
              <Trash2 /> <span className="hidden sm:inline">Vaciar</span>
              <span className="sr-only sm:hidden">Vaciar la cola</span>
            </Button>
          }
          contentClassName="p-0"
        >
          <QueueList items={visible} quantityOf={quantityOf} onQuantity={handleQuantity} onRemove={handleRemove} />
        </SectionCard>

        {/* ----- Hoja ----- */}
        <SectionCard
          icon={FileStack}
          title="Hoja A4"
          description="Grilla y posición de inicio. Se recuerda en este dispositivo."
          className="lg:sticky lg:top-20"
        >
          <div className="flex flex-col gap-5">
            <SheetSettings settings={settings} onChange={setSettings} />
            <Button type="button" size="lg" className="hidden w-full lg:inline-flex" disabled={!canPrint} onClick={() => setPreviewOpen(true)}>
              <Eye /> Vista previa e imprimir
            </Button>
            <p className="-mt-2 hidden text-center text-xs text-muted-foreground tabular-nums lg:block">{summary}</p>
          </div>
        </SectionCard>
      </div>

      {/* Celular: barra fija abajo con el botón principal */}
      <div className="sticky bottom-0 z-10 -mx-4 mt-auto border-t bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:hidden">
        <Button type="button" size="lg" className="w-full" disabled={!canPrint} onClick={() => setPreviewOpen(true)}>
          <Eye /> Vista previa · {summary}
        </Button>
      </div>

      <PrintPreviewDialog open={previewOpen} onOpenChange={setPreviewOpen} groups={groups} settings={settings} />

      <AlertDialog open={confirmClear} onOpenChange={setConfirmClear}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-destructive/10">
              <Trash2 className="text-destructive" />
            </AlertDialogMedia>
            <AlertDialogTitle>¿Vaciar la cola?</AlertDialogTitle>
            <AlertDialogDescription>
              Se quitan las {plural(total, "etiqueta", "etiquetas")} de la cola. Los productos y sus códigos no se tocan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={clearing}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="outline"
              className="border-destructive/40 text-destructive hover:bg-destructive/5 hover:text-destructive"
              onClick={handleClear}
              disabled={clearing}
            >
              {clearing ? <Loader2 className="animate-spin" /> : <Trash2 />}
              Vaciar cola
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function EmptyQueue() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed bg-background px-6 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-brand-soft">
        <Tag className="size-5 text-brand" aria-hidden />
      </div>
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold">La cola está vacía</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          En Productos, seleccioná uno o varios y tocá «Imprimir etiquetas». O, dentro de un producto, usá el botón
          «Etiquetas» de cada variante.
        </p>
      </div>
      <Link href="/admin/productos" className={buttonVariants({ size: "lg" })}>
        <Package /> Ir a Productos
      </Link>
    </div>
  );
}
