"use client";

import { useMemo } from "react";
import { PdfPreviewDialog } from "@/components/admin/pdf-preview-dialog";
import { buildSheets, type LabelGroup, type LabelSettings, type Measure, type SheetPage } from "@/lib/labels/layout";
import { createLabelsPdf } from "@/lib/labels/pdf";
import { SheetSvg } from "./sheet-svg";

/**
 * Vista previa de las hojas de etiquetas + "Descargar PDF" e "Imprimir"
 * (con el diálogo compartido del panel).
 */

type Input = { groups: LabelGroup[]; settings: LabelSettings };

const build = (input: Input, measure: Measure) => buildSheets(input.groups, input.settings, measure).pages;
const total = (pages: SheetPage[]) => pages.reduce((sum, p) => sum + p.labelCount, 0);

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
  const input = useMemo(() => ({ groups, settings }), [groups, settings]);
  return (
    <PdfPreviewDialog
      open={open}
      onOpenChange={onOpenChange}
      input={input}
      build={build}
      renderPage={(page, title) => <SheetSvg page={page} title={title} />}
      createPdf={createLabelsPdf}
      fileName="etiquetas-home-deko"
      printLabel={(pages) => {
        const n = total(pages);
        return `Imprimir ${n === 1 ? "1 etiqueta" : `${n} etiquetas`}`;
      }}
      caption={(page, i, count) =>
        `Hoja ${i + 1} de ${count} · ${page.labelCount} ${page.labelCount === 1 ? "etiqueta" : "etiquetas"}`
      }
      hint={
        <>
          Imprimí en <strong className="font-medium text-foreground">tamaño real (100 %)</strong>, sin «Ajustar a la
          página», para que el código se lea bien.
        </>
      }
    />
  );
}
