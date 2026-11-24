/**
 * RÓTULOS DE ENVÍO: hoja A4 con 4 rótulos (2 × 2, cada uno de 105 × 148,5 mm,
 * medio A5), con líneas de corte. Para pegar en el paquete.
 *
 *   ┌────────────────────────┐
 *   │ Home ♥ Deko   PEDIDO #1023
 *   │────────────────────────│
 *   │ DESTINATARIO           │
 *   │ Juan Pérez             │  ← grande
 *   │ Calle Falsa 123        │
 *   │ Piso / Depto: 2° B     │  ← si lo cargó
 *   │ Trevelin, Chubut       │
 *   │ CP 9203                │  ← muy grande
 *   │ Tel.: 2945 123456      │
 *   │ Indicaciones: …        │  ← si las cargó (hasta 3 renglones)
 *   │                        │
 *   │────────────────────────│
 *   │ REMITENTE              │
 *   │ Home Deko · dirección… │
 *   └────────────────────────┘
 *
 * "Empezar en la posición" (1 a 4) permite usar una hoja a la que ya se le
 * recortaron rótulos.
 */

import type { Measure } from "@/lib/labels/layout";
import {
  CAP_HEIGHT,
  emptyPage,
  LOGO,
  lineHeight,
  PAGE_H,
  PAGE_W,
  PT,
  textWidth,
  toWinAnsi,
  wrapText,
  type DocPage,
} from "./doc";

export type ShippingLabelData = {
  number: number;
  name: string;
  address: string;
  /** Piso / depto (opcional). */
  apartment: string | null;
  city: string;
  province: string;
  postalCode: string;
  phone: string;
  /** Indicaciones para la entrega (opcional): entre calles, timbre… */
  notes: string | null;
};

export type LabelSenderData = { name: string; lines: string[] };

export const LABELS_PER_PAGE = 4;
const CELL_W = PAGE_W / 2;
const CELL_H = PAGE_H / 2;
const PAD = 9;
const INNER_W = CELL_W - 2 * PAD;

const CUT = { width: 0.2, gray: 0.6, dash: [1.2, 1] as const };
const MUTED = 0.4;

/** "2945123456" → "2945 123456" (más fácil de leer para el cartero). */
function prettyPhone(phone: string): string {
  const d = phone.replace(/\D/g, "");
  return d.length === 10 ? `${d.slice(0, 4)} ${d.slice(4)}` : d;
}

export function buildShippingLabels(
  input: { labels: ShippingLabelData[]; sender: LabelSenderData; startAt: number },
  measure: Measure,
): DocPage[] {
  const pages: DocPage[] = [];
  const start = Math.min(Math.max(1, Math.round(input.startAt)), LABELS_PER_PAGE) - 1;

  input.labels.forEach((label, i) => {
    const pos = start + i;
    const pageIndex = Math.floor(pos / LABELS_PER_PAGE);
    while (pages.length <= pageIndex) pages.push(withCutLines(emptyPage()));
    const cell = pos % LABELS_PER_PAGE;
    drawLabel(pages[pageIndex], label, input.sender, (cell % 2) * CELL_W, Math.floor(cell / 2) * CELL_H, measure);
  });
  return pages;
}

function withCutLines(page: DocPage): DocPage {
  page.lines.push(
    { x1: CELL_W, y1: 0, x2: CELL_W, y2: PAGE_H, ...CUT },
    { x1: 0, y1: CELL_H, x2: PAGE_W, y2: CELL_H, ...CUT },
  );
  return page;
}

function drawLabel(
  page: DocPage,
  label: ShippingLabelData,
  sender: LabelSenderData,
  x0: number,
  y0: number,
  measure: Measure,
) {
  const left = x0 + PAD;
  const right = x0 + CELL_W - PAD;
  let y = y0 + PAD;

  const text = (t: string, sizePt: number, bold = false, gray = 0, x = left) =>
    page.texts.push({ text: t, x, y, sizePt, bold, gray });
  /** Bloque de renglones: baja `y` hasta la base de cada uno. */
  const block = (raw: string, sizePt: number, bold: boolean, maxLines: number, gray = 0) => {
    for (const l of wrapText(raw, INNER_W, sizePt, bold, measure, maxLines)) {
      y += lineHeight(sizePt);
      text(l, sizePt, bold, gray);
    }
  };

  // ---- Encabezado: logo + número de pedido -----------------------------
  const logoH = 6.5;
  page.images.push({ src: LOGO.src, x: left, y, w: logoH * LOGO.ratio, h: logoH });
  const orderLabel = toWinAnsi(`PEDIDO #${label.number}`);
  page.texts.push({
    text: orderLabel,
    x: right - textWidth(orderLabel, 11, true, measure),
    y: y + logoH / 2 + (11 * PT * CAP_HEIGHT) / 2,
    sizePt: 11,
    bold: true,
  });
  y += logoH + 4;
  page.lines.push({ x1: left, y1: y, x2: right, y2: y, width: 0.3 });
  y += 3;

  // ---- Destinatario -----------------------------------------------------
  block("DESTINATARIO", 8, true, 1, MUTED);
  y += 1;
  block(label.name, 16, true, 2);
  y += 1.5;
  block(label.address, 12, false, 2);
  if (label.apartment) block(`Piso / Depto: ${label.apartment}`, 12, false, 1);
  block(`${label.city}, ${label.province}`, 12, false, 2);
  y += 2;
  block(`CP ${label.postalCode}`, 22, true, 1);
  y += 1;
  block(`Tel.: ${prettyPhone(label.phone)}`, 12, false, 1);
  if (label.notes) {
    y += 1.5;
    block(`Indicaciones: ${label.notes}`, 9.5, false, 3);
  }

  // ---- Remitente (abajo de todo) -----------------------------------------
  const senderLines = sender.lines.flatMap((l) => wrapText(l, INNER_W, 9, false, measure, 2)).slice(0, 4);
  const senderH = lineHeight(8) + lineHeight(10) + senderLines.length * lineHeight(9);
  y = y0 + CELL_H - PAD - senderH - 3;
  page.lines.push({ x1: left, y1: y, x2: right, y2: y, width: 0.3 });
  y += 1;
  block("REMITENTE", 8, true, 1, MUTED);
  block(sender.name, 10, true, 1);
  for (const l of senderLines) {
    y += lineHeight(9);
    text(l, 9);
  }
}
