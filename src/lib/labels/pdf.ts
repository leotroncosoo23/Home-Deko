/**
 * PDF de etiquetas con pdf-lib (corre en el navegador).
 *
 * pdf-lib pesa bastante, así que se carga con import() recién cuando hace
 * falta (al entrar a Etiquetas con algo en la cola), no en todo el panel.
 *
 * Unidades: el layout está en mm con el origen ARRIBA a la izquierda; un
 * PDF usa puntos (1/72 de pulgada) con el origen ABAJO a la izquierda.
 * Las funciones px() / py() convierten.
 */

import { ean13Bars } from "./ean13";
import { PAGE_H, PAGE_W, type Measure, type SheetPage } from "./layout";

const MM = 72 / 25.4; // 1 mm en puntos
const px = (mm: number) => mm * MM;
const py = (mm: number) => (PAGE_H - mm) * MM;

/** Gris de los títulos, el pie y las líneas de corte (igual en la vista previa). */
export const MUTED_GRAY = 0.45;
export const CUT_GRAY = 0.6;
/** Punteado de las líneas de corte, en mm: 1,2 mm de línea y 1 de espacio. */
export const CUT_DASH = [1.2, 1] as const;
/** Grosor de las líneas de corte, en mm. */
export const CUT_WIDTH = 0.2;

/**
 * Función para medir textos con la Helvetica REAL del PDF. La usan la
 * vista previa y el armado de hojas, para que todo corte igual.
 */
export async function loadMeasure(): Promise<Measure> {
  const { PDFDocument, StandardFonts } = await import("pdf-lib");
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  return (text, sizePt, isBold) => (isBold ? bold : regular).widthOfTextAtSize(text, sizePt) / MM;
}

/** Arma el PDF con las hojas ya calculadas por buildSheets(). */
export async function createLabelsPdf(pages: SheetPage[]): Promise<Uint8Array> {
  const { PDFDocument, PrintScaling, StandardFonts, grayscale } = await import("pdf-lib");
  const doc = await PDFDocument.create();
  doc.setTitle("Etiquetas Home Deko");
  doc.setCreator("Panel Home Deko");
  doc.setProducer("Panel Home Deko");
  // Que el visor imprima en tamaño real (sin "ajustar a la página").
  doc.catalog.getOrCreateViewerPreferences().setPrintScaling(PrintScaling.None);

  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const black = grayscale(0);

  for (const sheet of pages) {
    const page = doc.addPage([px(PAGE_W), px(PAGE_H)]);

    // 1. Líneas de corte (abajo de todo)
    for (const cut of sheet.cuts) {
      page.drawLine({
        start: { x: px(cut.x1), y: py(cut.y1) },
        end: { x: px(cut.x2), y: py(cut.y2) },
        thickness: px(CUT_WIDTH),
        color: grayscale(CUT_GRAY),
        dashArray: CUT_DASH.map(px),
      });
    }

    // 2. Códigos: cada barra es un rectángulo negro (vector puro, nítido)
    for (const bc of sheet.barcodes) {
      for (const bar of ean13Bars(bc.code)) {
        const height = bc.barH + (bar.guard ? bc.guardExtra : 0);
        page.drawRectangle({
          x: px(bc.x + bar.x * bc.moduleX),
          y: py(bc.top + height),
          width: px(bar.width * bc.moduleX),
          height: px(height),
          color: black,
        });
      }
    }

    // 3. Textos
    for (const t of sheet.texts) {
      page.drawText(t.text, {
        x: px(t.x),
        y: py(t.y),
        size: t.sizePt,
        font: t.bold ? bold : regular,
        color: grayscale(t.muted ? MUTED_GRAY : 0),
      });
    }
  }

  return doc.save();
}
