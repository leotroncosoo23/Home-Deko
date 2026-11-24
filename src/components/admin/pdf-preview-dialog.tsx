"use client";

import { Suspense, use, useEffect, useMemo, useState } from "react";
import { Download, Info, Loader2, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import type { Measure } from "@/lib/labels/layout";
import { loadMeasure } from "@/lib/labels/pdf";

/**
 * Vista previa de un PDF del panel + "Descargar PDF" e "Imprimir".
 * La usan Etiquetas, los rótulos de envío y la lista de preparación.
 * En el celular ocupa toda la pantalla.
 *
 * Cómo se usa: `build(input, measure)` arma las hojas (con la medida real
 * de Helvetica), `renderPage` las dibuja en SVG y `createPdf` arma el PDF
 * con las MISMAS hojas. `build` tiene que ser una función fija (de módulo)
 * y `input` no tiene que cambiar en cada render (useMemo), porque cada
 * cambio vuelve a armar el PDF.
 */

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

export type PdfPreviewProps<I, P> = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  input: I;
  build: (input: I, measure: Measure) => P[];
  renderPage: (page: P, title: string) => React.ReactNode;
  createPdf: (pages: P[]) => Promise<Uint8Array>;
  /** Sin ".pdf"; se le agrega la fecha. Ej.: "rotulos-home-deko". */
  fileName: string;
  /** Texto del botón: "Imprimir 4 rótulos". */
  printLabel: (pages: P[]) => string;
  /** Texto debajo de cada hoja: "Hoja 1 de 2 · 4 rótulos". */
  caption?: (page: P, index: number, total: number) => string;
  /** Aviso al lado de los botones. */
  hint?: React.ReactNode;
  /** Opciones arriba de las hojas (ej.: "Empezar en la posición"). */
  toolbar?: React.ReactNode;
};

export function PdfPreviewDialog<I, P>(props: PdfPreviewProps<I, P>) {
  const { open, onOpenChange, title = "Vista previa", description = "Así sale el PDF: mismo tamaño, mismas posiciones." } = props;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-dvh max-h-dvh w-full max-w-full flex-col gap-0 rounded-none p-0 sm:h-[92dvh] sm:max-w-3xl sm:rounded-xl">
        <DialogHeader className="border-b px-4 py-3 pr-12">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {props.toolbar && <div className="border-b px-4 py-2.5">{props.toolbar}</div>}
        {open && (
          <Suspense fallback={<PreviewSkeleton />}>
            <Preview {...props} measure={getMeasure()} />
          </Suspense>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Preview<I, P>({
  measure: measurePromise,
  input,
  build,
  renderPage,
  createPdf,
  fileName,
  printLabel,
  caption,
  hint,
}: PdfPreviewProps<I, P> & { measure: Promise<Measure> }) {
  const measure = use(measurePromise);
  const pages = useMemo(() => build(input, measure), [build, input, measure]);

  // El PDF se arma apenas se abre la vista previa: así "Imprimir" y
  // "Descargar" responden al toque (en el celular, abrir una pestaña
  // DESPUÉS de esperar algo suele quedar bloqueado).
  const [pdf, setPdf] = useState<{ url: string; forPages: P[] } | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let url: string | null = null;
    let cancelled = false;
    createPdf(pages)
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
  }, [pages, createPdf]);
  const pdfUrl = pdf?.forPages === pages ? pdf.url : null;

  const fullName = `${fileName}-${new Date().toLocaleDateString("sv-SE", { timeZone: "America/Argentina/Buenos_Aires" })}.pdf`;

  function download() {
    if (!pdfUrl) return;
    const a = document.createElement("a");
    a.href = pdfUrl;
    a.download = fullName;
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
                {renderPage(page, `Hoja ${i + 1} de ${pages.length}`)}
              </div>
              <figcaption className="text-center text-xs text-muted-foreground tabular-nums">
                {caption ? caption(page, i, pages.length) : `Hoja ${i + 1} de ${pages.length}`}
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
            {hint ?? (
              <>
                Imprimí en <strong className="font-medium text-foreground">tamaño real (100 %)</strong>, sin «Ajustar a
                la página».
              </>
            )}
          </span>
        </p>
        <div className="flex gap-2">
          <Button type="button" variant="outline" className="flex-1 sm:flex-none" onClick={download} disabled={!pdfUrl}>
            <Download /> Descargar PDF
          </Button>
          <Button type="button" className="flex-1 sm:flex-none" onClick={print} disabled={!pdfUrl}>
            {pdfUrl || failed ? <Printer /> : <Loader2 className="animate-spin" />}
            {printLabel(pages)}
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
