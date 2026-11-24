/**
 * Hojas A4 "genéricas" para imprimir desde el panel: rótulos de envío y
 * lista de preparación.
 *
 * Igual que las etiquetas (src/lib/labels/): un armador calcula dónde va
 * cada cosa (en mm, origen arriba a la izquierda) y después la vista previa
 * (SVG) y el PDF (pdf-lib) dibujan EXACTAMENTE lo mismo.
 *
 * Los textos se pasan por toWinAnsi() al armar (Helvetica del PDF no tiene
 * emojis ni algunos símbolos), así la vista previa muestra lo mismo que el PDF.
 */

import { PAGE_H, PAGE_W, toWinAnsi, type Measure } from "@/lib/labels/layout";

export { PAGE_H, PAGE_W };

export type DocText = {
  text: string;
  /** Borde izquierdo. */
  x: number;
  /** Línea de base. */
  y: number;
  sizePt: number;
  bold?: boolean;
  /** 0 = negro, 1 = blanco. */
  gray?: number;
};

export type DocLine = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** Grosor en mm. */
  width: number;
  gray?: number;
  /** Punteado en mm (línea, espacio). */
  dash?: readonly number[];
};

/** Rectángulo con borde (casillas para tildar, recuadros). */
export type DocRect = { x: number; y: number; w: number; h: number; width: number; gray?: number };

/** Imagen PNG de /public (ej.: el logo). */
export type DocImage = { src: string; x: number; y: number; w: number; h: number };

export type DocPage = { texts: DocText[]; lines: DocLine[]; rects: DocRect[]; images: DocImage[] };

export const emptyPage = (): DocPage => ({ texts: [], lines: [], rects: [], images: [] });

/** 1 punto tipográfico en mm. */
export const PT = 25.4 / 72;
/** Alto de las mayúsculas de Helvetica en proporción al tamaño. */
export const CAP_HEIGHT = 0.718;
/** Alto de renglón cómodo para un tamaño dado, en mm. */
export const lineHeight = (sizePt: number) => sizePt * PT * 1.3;

/** Logo "Home ♥ Deko" (sin la frase): 1303 × 235 px. */
export const LOGO = { src: "/brand/logo-horizontal-sin-frase-negro.png", ratio: 1303 / 235 };

/**
 * Corta un texto en renglones que entren en `maxW` mm. Si no entra en
 * `maxLines`, el último renglón termina en "…".
 */
export function wrapText(
  raw: string,
  maxW: number,
  sizePt: number,
  bold: boolean,
  measure: Measure,
  maxLines = Infinity,
): string[] {
  const text = toWinAnsi(raw).replace(/\s+/g, " ").trim();
  if (!text) return [];
  const fits = (s: string) => measure(s, sizePt, bold) <= maxW;

  const lines: string[] = [];
  let current = "";
  for (const word of text.split(" ")) {
    const candidate = current ? `${current} ${word}` : word;
    if (fits(candidate)) {
      current = candidate;
      continue;
    }
    if (current) lines.push(current);
    // Una palabra sola más larga que el renglón: se corta por letras
    let rest = word;
    while (!fits(rest) && rest.length > 1) {
      let cut = rest.length - 1;
      while (cut > 1 && !fits(rest.slice(0, cut))) cut--;
      lines.push(rest.slice(0, cut));
      rest = rest.slice(cut);
    }
    current = rest;
  }
  if (current) lines.push(current);

  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  let last = kept[maxLines - 1];
  while (last.length > 1 && !fits(`${last}…`)) last = last.slice(0, -1);
  kept[maxLines - 1] = `${last.trimEnd()}…`;
  return kept;
}

/** Ancho de un texto ya convertido (para alinear a la derecha o centrar). */
export function textWidth(text: string, sizePt: number, bold: boolean, measure: Measure): number {
  return measure(text, sizePt, bold);
}

export { toWinAnsi };

// ---------------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------------

const MM = 72 / 25.4;
const px = (mm: number) => mm * MM;
const py = (mm: number) => (PAGE_H - mm) * MM;

/** Arma el PDF (en el navegador). pdf-lib se carga recién acá. */
export async function createDocPdf(pages: DocPage[], title: string): Promise<Uint8Array> {
  const { PDFDocument, PrintScaling, StandardFonts, grayscale } = await import("pdf-lib");
  const doc = await PDFDocument.create();
  doc.setTitle(title);
  doc.setCreator("Panel Home Deko");
  doc.setProducer("Panel Home Deko");
  doc.catalog.getOrCreateViewerPreferences().setPrintScaling(PrintScaling.None);

  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  // Cada imagen distinta se baja e incrusta una sola vez
  const images = new Map<string, Awaited<ReturnType<typeof doc.embedPng>>>();
  for (const src of new Set(pages.flatMap((p) => p.images.map((i) => i.src)))) {
    const bytes = await fetch(src).then((r) => {
      if (!r.ok) throw new Error(`No se pudo cargar ${src}`);
      return r.arrayBuffer();
    });
    images.set(src, await doc.embedPng(bytes));
  }

  for (const sheet of pages) {
    const page = doc.addPage([px(PAGE_W), px(PAGE_H)]);
    for (const l of sheet.lines) {
      page.drawLine({
        start: { x: px(l.x1), y: py(l.y1) },
        end: { x: px(l.x2), y: py(l.y2) },
        thickness: px(l.width),
        color: grayscale(l.gray ?? 0),
        ...(l.dash ? { dashArray: l.dash.map(px) } : {}),
      });
    }
    for (const r of sheet.rects) {
      page.drawRectangle({
        x: px(r.x),
        y: py(r.y + r.h),
        width: px(r.w),
        height: px(r.h),
        borderWidth: px(r.width),
        borderColor: grayscale(r.gray ?? 0),
      });
    }
    for (const img of sheet.images) {
      const embedded = images.get(img.src);
      if (embedded) page.drawImage(embedded, { x: px(img.x), y: py(img.y + img.h), width: px(img.w), height: px(img.h) });
    }
    for (const t of sheet.texts) {
      page.drawText(t.text, {
        x: px(t.x),
        y: py(t.y),
        size: t.sizePt,
        font: t.bold ? bold : regular,
        color: grayscale(t.gray ?? 0),
      });
    }
  }
  return doc.save();
}
