"use client";

import { Suspense, use, useEffect, useMemo, useState } from "react";
import { Download, Info, Loader2, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { buildSheets, type LabelGroup, type LabelSettings, type Measure } from "@/lib/labels/layout";
import { createLabelsPdf, loadMeasure } from "@/lib/labels/pdf";
import { SheetSvg } from "./sheet-svg";

/**
 * Medidor de textos con la Helvetica del PDF. Se carga UNA vez (trae
 * pdf-lib) y queda guardado para las próximas vistas previas.
 */
let measurePromise: Promise<Measure> | null = null;
function getMeasure() {
  measurePromise ??= loadMeasure().catch((error) => {
    measurePromise = null; // si falló (ej.: sin conexión), reintentar la próxima vez
    throw error;
  });
  return measurePromise;
}

/**
 * Vista previa de las hojas + "Descargar PDF" e "Imprimir".
 * En el celular ocupa toda la pantalla.
 */
export function PrintPreviewDialog({
  open,
  onOpenChange,
  groups,
  settings,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: LabelGroup[];
  settings: LabelSettings;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-dvh max-h-dvh w-full max-w-full flex-col gap-0 rounded-none p-0 sm:h-[92dvh] sm:max-w-3xl sm:rounded-xl">
        <DialogHeader className="border-b px-4 py-3 pr-12">
          <DialogTitle>Vista previa</DialogTitle>
          <DialogDescription>Así sale el PDF: mismo tamaño, mismas posiciones.</DialogDescription>
        </DialogHeader>
        {open && (
          <Suspense fallback={<PreviewSkeleton />}>
            <Preview measure={getMeasure()} groups={groups} settings={settings} />
          </Suspense>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Preview({
  measure: measurePromise,
  groups,
  settings,
}: {
  measure: Promise<Measure>;
  groups: LabelGroup[];
  settings: LabelSettings;
}) {
  const measure = use(measurePromise);
  const { pages, total } = useMemo(() => buildSheets(groups, settings, measure), [groups, settings, measure]);

  // El PDF se arma apenas se abre la vista previa: así "Imprimir" y
  // "Descargar" responden al toque (en el celular, abrir una pestaña
  // DESPUÉS de esperar algo suele quedar bloqueado).
  const [pdf, setPdf] = useState<{ url: string; forPages: typeof pages } | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let url: string | null = null;
    let cancelled = false;
    createLabelsPdf(pages)
      .then((bytes) => {
        if (cancelled) return;
        url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
        setPdf({ url, forPages: pages });
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [pages]);
  const pdfUrl = pdf?.forPages === pages ? pdf.url : null;

  const fileName = `etiquetas-home-deko-${new Date().toLocaleDateString("sv-SE", { timeZone: "America/Argentina/Buenos_Aires" })}.pdf`;

  function download() {
    if (!pdfUrl) return;
    const a = document.createElement("a");
    a.href = pdfUrl;
    a.download = fileName;
    a.click();
  }

  function print() {
    if (!pdfUrl) return;
    // Celular / tablet: el PDF se abre en el visor del sistema, que tiene
    // "Imprimir" y "Compartir". (Un PDF dentro de la página no se puede
    // imprimir en el celular.)
    if (window.matchMedia("(pointer: coarse)").matches) {
      const tab = window.open(pdfUrl, "_blank");
      if (!tab) toast.error("El navegador bloqueó la ventana nueva. Usá «Descargar PDF» y imprimilo desde ahí.");
      return;
    }
    // PC: un marco invisible con el PDF y el diálogo de impresión del navegador
    document.getElementById("hd-print-frame")?.remove();
    const frame = document.createElement("iframe");
    frame.id = "hd-print-frame";
    frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
    frame.src = pdfUrl;
    frame.onload = () => {
      try {
        frame.contentWindow?.focus();
        frame.contentWindow?.print();
      } catch {
        window.open(pdfUrl, "_blank");
      }
    };
    document.body.appendChild(frame);
  }

  return (
    <>
      {/* Hojas */}
      <div className="min-h-0 flex-1 overflow-y-auto bg-muted/60 px-3 py-4 sm:px-6">
        <div className="mx-auto flex max-w-2xl flex-col gap-5">
          {pages.map((page, i) => (
            <figure key={i} className="flex flex-col gap-1.5">
              <div className="overflow-hidden rounded-sm shadow-(--shadow-card) ring-1 ring-foreground/10">
                <SheetSvg page={page} title={`Hoja ${i + 1} de ${pages.length}`} />
              </div>
              <figcaption className="text-center text-xs text-muted-foreground tabular-nums">
                Hoja {i + 1} de {pages.length} · {page.labelCount} {page.labelCount === 1 ? "etiqueta" : "etiquetas"}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>

      {/* Acciones */}
      <div className="flex flex-col gap-3 border-t bg-background px-4 py-3 sm:flex-row sm:items-center">
        <p className="flex items-start gap-2 text-xs text-muted-foreground sm:flex-1">
          <Info className="mt-px size-3.5 shrink-0" aria-hidden />
          <span>
            Imprimí en <strong className="font-medium text-foreground">tamaño real (100 %)</strong>, sin «Ajustar a la
            página», para que el código se lea bien.
          </span>
        </p>
        <div className="flex gap-2">
          <Button type="button" variant="outline" className="flex-1 sm:flex-none" onClick={download} disabled={!pdfUrl}>
            <Download /> Descargar PDF
          </Button>
          <Button type="button" className="flex-1 sm:flex-none" onClick={print} disabled={!pdfUrl}>
            {pdfUrl || failed ? <Printer /> : <Loader2 className="animate-spin" />}
            Imprimir {total === 1 ? "1 etiqueta" : `${total} etiquetas`}
          </Button>
        </div>
        {failed && <p className="text-xs text-destructive">No se pudo armar el PDF. Cerrá y volvé a abrir la vista previa.</p>}
      </div>
    </>
  );
}

function PreviewSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center gap-3 bg-muted/60 p-6" aria-busy aria-label="Preparando la vista previa">
      <Skeleton className="aspect-210/297 w-full max-w-2xl rounded-sm" />
    </div>
  );
}
