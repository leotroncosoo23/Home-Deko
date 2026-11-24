/**
 * LISTA DE PREPARACIÓN: A4 vertical, para juntar los productos de varios
 * pedidos de una vez.
 *
 *   1. "Para juntar": todo lo que hay que sacar del depósito, sumado
 *      (si 3 pedidos llevan la misma taza roja, dice "3 ×" una sola vez).
 *   2. Cada pedido con sus productos, para armar las cajas.
 * Cada renglón tiene una casilla para tildar con birome.
 */

import type { Measure } from "@/lib/labels/layout";
import { emptyPage, lineHeight, PAGE_H, PAGE_W, textWidth, toWinAnsi, wrapText, type DocPage } from "./doc";

export type PickingOrder = {
  number: number;
  customerName: string;
  /** "Envío a domicilio · Trevelin, Chubut" o "Retiro en el local". */
  delivery: string;
  /** Piso/depto e indicaciones para la entrega, si hay ("Piso / Depto: 2° B · Indicaciones: timbre 3"). */
  details: string | null;
  items: { name: string; variant: string | null; quantity: number }[];
};

const M = 15;
const BOTTOM = PAGE_H - M - 8; // deja lugar para "Hoja 1 de 2"
const W = PAGE_W - 2 * M;
const MUTED = 0.4;
const BOX = 3.6;
const QTY_W = 13;

export function buildPickingList(input: { orders: PickingOrder[]; dateLabel: string }, measure: Measure): DocPage[] {
  const pages: DocPage[] = [emptyPage()];
  let page = pages[0];
  let y = M;

  const newPage = () => {
    page = emptyPage();
    pages.push(page);
    y = M;
  };
  /** Si no entra `h` mm más en la hoja, pasa a la siguiente. */
  const ensure = (h: number) => {
    if (y + h > BOTTOM) newPage();
  };
  const text = (t: string, x: number, sizePt: number, bold = false, gray = 0) =>
    page.texts.push({ text: toWinAnsi(t), x, y, sizePt, bold, gray });
  const rule = (gray = 0.75, width = 0.25) => page.lines.push({ x1: M, y1: y, x2: M + W, y2: y, width, gray });

  /** Renglón con casilla: [ ]  3 ×  Taza esmaltada — Rojo / 300 ml */
  const itemRow = (qty: number, name: string, variant: string | null, sizePt: number) => {
    const label = variant ? `${name} — ${variant}` : name;
    const lines = wrapText(label, W - BOX - 3 - QTY_W, sizePt, false, measure, 3);
    const lh = lineHeight(sizePt);
    ensure(lines.length * lh + 2);
    y += lh;
    page.rects.push({ x: M, y: y - BOX + 0.6, w: BOX, h: BOX, width: 0.3 });
    text(`${qty} ×`, M + BOX + 3, sizePt, true);
    lines.forEach((l, i) => {
      if (i > 0) y += lh;
      page.texts.push({ text: l, x: M + BOX + 3 + QTY_W, y, sizePt });
    });
    y += 1.2;
  };

  // ---- Título ----------------------------------------------------------
  y += lineHeight(18);
  text("Lista de preparación", M, 18, true);
  const n = input.orders.length;
  const sub = toWinAnsi(`${input.dateLabel} · ${n === 1 ? "1 pedido" : `${n} pedidos`}`);
  page.texts.push({ text: sub, x: M + W - textWidth(sub, 10, false, measure), y, sizePt: 10, gray: MUTED });
  y += 4;
  rule(0, 0.4);
  y += 3;

  // ---- 1. Para juntar (todo sumado) ------------------------------------
  const totals = new Map<string, { name: string; variant: string | null; quantity: number }>();
  for (const o of input.orders) {
    for (const i of o.items) {
      const key = `${i.name}\u0000${i.variant ?? ""}`;
      const prev = totals.get(key);
      if (prev) prev.quantity += i.quantity;
      else totals.set(key, { ...i });
    }
  }
  const sorted = [...totals.values()].sort(
    (a, b) => a.name.localeCompare(b.name, "es") || (a.variant ?? "").localeCompare(b.variant ?? "", "es"),
  );
  const units = sorted.reduce((s, i) => s + i.quantity, 0);

  y += lineHeight(12);
  text("Para juntar", M, 12, true);
  const unitsLabel = toWinAnsi(units === 1 ? "1 unidad" : `${units} unidades`);
  page.texts.push({ text: unitsLabel, x: M + W - textWidth(unitsLabel, 10, false, measure), y, sizePt: 10, gray: MUTED });
  y += 1.5;
  for (const i of sorted) itemRow(i.quantity, i.name, i.variant, 10.5);
  y += 5;

  // ---- 2. Pedido por pedido --------------------------------------------
  ensure(lineHeight(12) + 12);
  y += lineHeight(12);
  text("Por pedido", M, 12, true);
  y += 2;

  for (const o of input.orders) {
    // Que el encabezado no quede solo al final de una hoja
    ensure(lineHeight(11) + lineHeight(9) * (o.details ? 3 : 1) + lineHeight(10) + 6);
    y += 1.5;
    rule();
    y += lineHeight(11);
    text(`Pedido #${o.number}`, M, 11, true);
    const name = wrapText(o.customerName, W - 60, 11, false, measure, 1)[0] ?? "";
    page.texts.push({ text: name, x: M + 30, y, sizePt: 11 });
    y += lineHeight(9);
    const delivery = wrapText(o.delivery, W, 9, false, measure, 1)[0] ?? "";
    page.texts.push({ text: delivery, x: M, y, sizePt: 9, gray: MUTED });
    if (o.details) {
      for (const l of wrapText(o.details, W, 9, false, measure, 2)) {
        y += lineHeight(9);
        page.texts.push({ text: l, x: M, y, sizePt: 9, gray: MUTED });
      }
    }
    y += 0.5;
    for (const i of o.items) itemRow(i.quantity, i.name, i.variant, 10);
    y += 2;
  }

  // ---- Pie: "Hoja 1 de 2" ------------------------------------------------
  pages.forEach((p, i) => {
    const label = `Hoja ${i + 1} de ${pages.length}`;
    p.texts.push({
      text: label,
      x: PAGE_W / 2 - textWidth(label, 8, false, measure) / 2,
      y: PAGE_H - M + 2,
      sizePt: 8,
      gray: MUTED,
    });
  });
  return pages;
}
