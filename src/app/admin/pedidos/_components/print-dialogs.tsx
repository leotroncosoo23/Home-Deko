"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { DocPageSvg } from "@/components/admin/doc-page-svg";
import { PdfPreviewDialog } from "@/components/admin/pdf-preview-dialog";
import { titleCase } from "@/lib/format";
import { deliveryDetails } from "@/lib/order-messages";
import { createDocPdf, type DocPage } from "@/lib/print/doc";
import { buildPickingList, type PickingOrder } from "@/lib/print/picking-list";
import { buildShippingLabels, LABELS_PER_PAGE, type ShippingLabelData } from "@/lib/print/shipping-labels";
import { cn } from "@/lib/utils";
import { getPrintData } from "../actions";
import type { PrintData } from "../types";

/**
 * Imprimir rótulos de envío y la lista de preparación de uno o varios
 * pedidos. Se usa desde la lista (selección múltiple) y desde el detalle.
 *
 *   const print = usePrintOrders();
 *   print.labels(ids) / print.picking(ids)  →  {print.dialogs}
 */
export function usePrintOrders() {
  const [loading, startLoading] = useTransition();
  const [data, setData] = useState<PrintData | null>(null);
  const [open, setOpen] = useState<"labels" | "picking" | null>(null);

  function load(ids: string[], kind: "labels" | "picking") {
    startLoading(async () => {
      try {
        const result = await getPrintData(ids);
        if ("error" in result) {
          toast.error(result.error);
          return;
        }
        if (kind === "labels") {
          const shipping = result.orders.filter((o) => !o.pickup);
          const pickups = result.orders.length - shipping.length;
          if (shipping.length === 0) {
            toast.info(
              result.orders.length === 1
                ? "Este pedido es para retirar en el local: no lleva rótulo."
                : "Los pedidos elegidos son para retirar en el local: no llevan rótulo.",
            );
            return;
          }
          if (pickups > 0) {
            toast.info(
              pickups === 1
                ? "Se dejó afuera 1 pedido para retirar (no lleva rótulo)."
                : `Se dejaron afuera ${pickups} pedidos para retirar (no llevan rótulo).`,
            );
          }
          setData({ ...result, orders: shipping });
        } else {
          setData(result);
        }
        setOpen(kind);
      } catch {
        toast.error("No se pudieron cargar los pedidos. Revisá tu conexión e intentá de nuevo.");
      }
    });
  }

  const dialogs = (
    <>
      <ShippingLabelsDialog open={open === "labels"} onOpenChange={(o) => !o && setOpen(null)} data={data} />
      <PickingListDialog open={open === "picking"} onOpenChange={(o) => !o && setOpen(null)} data={data} />
    </>
  );

  return {
    loading,
    labels: (ids: string[]) => load(ids, "labels"),
    picking: (ids: string[]) => load(ids, "picking"),
    dialogs,
  };
}

// ---------------------------------------------------------------------------
// Rótulos
// ---------------------------------------------------------------------------
type LabelsInput = Parameters<typeof buildShippingLabels>[0];
const buildLabels = (input: LabelsInput, measure: Parameters<typeof buildShippingLabels>[1]) =>
  buildShippingLabels(input, measure);
const labelsPdf = (pages: DocPage[]) => createDocPdf(pages, "Rótulos de envío Home Deko");
const renderDocPage = (page: DocPage, title: string) => <DocPageSvg page={page} title={title} />;

function ShippingLabelsDialog({
  open,
  onOpenChange,
  data,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: PrintData | null;
}) {
  const [startAt, setStartAt] = useState(1);
  const input = useMemo<LabelsInput>(
    () => ({
      startAt,
      sender: data?.sender ?? { name: "Home Deko", lines: [] },
      labels: (data?.orders ?? []).map(
        (o): ShippingLabelData => ({
          number: o.number,
          // Mayúscula inicial solo para mostrar (lo guardado no cambia)
          name: titleCase(o.customerName),
          address: o.address ?? "",
          apartment: o.apartment,
          city: titleCase(o.city),
          province: titleCase(o.province),
          postalCode: o.postalCode ?? "",
          phone: o.phone,
          notes: o.notes,
        }),
      ),
    }),
    [data, startAt],
  );
  const count = input.labels.length;

  return (
    <PdfPreviewDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Rótulos de envío"
      description="4 por hoja A4. Recortá por las líneas punteadas y pegá cada uno en su paquete."
      input={input}
      build={buildLabels}
      renderPage={renderDocPage}
      createPdf={labelsPdf}
      fileName="rotulos-home-deko"
      printLabel={() => `Imprimir ${count === 1 ? "1 rótulo" : `${count} rótulos`}`}
      toolbar={<StartAtPicker value={startAt} onChange={setStartAt} />}
    />
  );
}

/** "Empezar en": para usar una hoja a la que ya se le recortaron rótulos. */
function StartAtPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <span id="start-at-label" className="text-muted-foreground">
        Empezar en la posición:
      </span>
      <div role="radiogroup" aria-labelledby="start-at-label" className="grid grid-cols-2 gap-1 rounded-md border bg-muted/40 p-1">
        {Array.from({ length: LABELS_PER_PAGE }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`Posición ${n}`}
            onClick={() => onChange(n)}
            className={cn(
              "flex h-6 w-8 items-center justify-center rounded-sm text-xs font-medium tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
              value === n ? "bg-foreground text-background" : "bg-background hover:bg-muted",
            )}
          >
            {n}
          </button>
        ))}
      </div>
      <span className="text-xs text-muted-foreground">(1 = arriba a la izquierda; útil si a la hoja ya le recortaste algunos)</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Lista de preparación
// ---------------------------------------------------------------------------
type PickingInput = Parameters<typeof buildPickingList>[0];
const buildPicking = (input: PickingInput, measure: Parameters<typeof buildPickingList>[1]) =>
  buildPickingList(input, measure);
const pickingPdf = (pages: DocPage[]) => createDocPdf(pages, "Lista de preparación Home Deko");

function PickingListDialog({
  open,
  onOpenChange,
  data,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: PrintData | null;
}) {
  const input = useMemo<PickingInput>(
    () => ({
      dateLabel: new Date().toLocaleDateString("es-AR", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "America/Argentina/Buenos_Aires",
      }),
      orders: (data?.orders ?? []).map(
        (o): PickingOrder => ({
          number: o.number,
          customerName: titleCase(o.customerName),
          delivery: o.pickup
            ? "Retiro en el local"
            : `Envío a domicilio · ${titleCase(o.city)}, ${titleCase(o.province)}`,
          details: o.pickup ? null : deliveryDetails(o.apartment, o.notes),
          items: o.items,
        }),
      ),
    }),
    [data],
  );
  const count = input.orders.length;

  return (
    <PdfPreviewDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Lista de preparación"
      description="Arriba, todo lo que hay que juntar; abajo, pedido por pedido para armar las cajas."
      input={input}
      build={buildPicking}
      renderPage={renderDocPage}
      createPdf={pickingPdf}
      fileName="lista-de-preparacion-home-deko"
      printLabel={() => `Imprimir lista (${count === 1 ? "1 pedido" : `${count} pedidos`})`}
      hint="Tildá cada producto a medida que lo vas juntando."
    />
  );
}
