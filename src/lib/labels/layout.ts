/**
 * Diseño de la hoja A4 de etiquetas. TODO en milímetros, con el origen
 * arriba a la izquierda (como se lee una hoja).
 *
 * Este archivo es el "motor" único: calcula dónde va cada cosa, y después
 *   - la vista previa (SVG) y
 *   - el PDF (pdf-lib)
 * dibujan exactamente lo mismo. Por eso la vista previa es fiel al PDF.
 *
 * Cada fila de la grilla tiene arriba una FRANJA fina para el título del
 * grupo ("Taza – Rojo / 300 ml (12)"). La franja queda entre dos líneas
 * de corte y se descarta al recortar:
 *
 *   ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
 *   Taza – Rojo / 300 ml (6)          ← franja (3,5 mm)
 *   ┄┄┄┄┄┄┬┄┄┄┄┄┄┬┄┄┄┄┄┄┬┄┄┄┄┄       ← corte
 *   etiq. ┆ etiq. ┆ etiq. ┆ etiq.     ← etiquetas
 *   ┄┄┄┄┄┄┴┄┄┄┄┄┄┴┄┄┄┄┄┄┴┄┄┄┄┄       ← corte
 */

import { EAN13_TOTAL_MODULES, QUIET_LEFT, ean13DigitCenters } from "./ean13";

// ---------------------------------------------------------------------
// Hoja y configuración
// ---------------------------------------------------------------------
export const PAGE_W = 210;
export const PAGE_H = 297;
const MARGIN_X = 7;
const MARGIN_Y = 8;
/** Franja de título arriba de cada fila. */
const BAND_H = 3.5;
/** Espacio libre dentro de cada etiqueta (por si el corte no es perfecto). */
const PAD = 1.8;

export type LabelSettings = {
  columns: number;
  rows: number;
  /** Posición (1 = arriba a la izquierda) donde empieza la primera etiqueta. */
  startAt: number;
};

export const DEFAULT_SETTINGS: LabelSettings = { columns: 4, rows: 10, startAt: 1 };
export const COLUMN_CHOICES = [2, 3, 4, 5] as const;
export const ROW_CHOICES = [5, 6, 7, 8, 9, 10, 11, 12] as const;

/** Corrige valores fuera de rango (ej.: lo que quedó guardado en el navegador). */
export function normalizeSettings(s: Partial<LabelSettings> | null | undefined): LabelSettings {
  const pick = (value: unknown, choices: readonly number[], fallback: number) =>
    typeof value === "number" && choices.includes(value) ? value : fallback;
  const columns = pick(s?.columns, COLUMN_CHOICES, DEFAULT_SETTINGS.columns);
  const rows = pick(s?.rows, ROW_CHOICES, DEFAULT_SETTINGS.rows);
  const startAt =
    typeof s?.startAt === "number" && Number.isInteger(s.startAt) && s.startAt >= 1 && s.startAt <= columns * rows
      ? s.startAt
      : 1;
  return { columns, rows, startAt };
}

// ---------------------------------------------------------------------
// Tipografía (Helvetica, la que trae todo PDF)
// ---------------------------------------------------------------------
const PT = 25.4 / 72; // 1 punto tipográfico en mm
/** Alto de las mayúsculas y números de Helvetica, en proporción al tamaño. */
const CAP_HEIGHT = 0.718;

const NAME_PT = 7;
const VARIANT_PT = 6.5;
const TITLE_PT = 6.5;
const FOOTER_PT = 6;
/** Tamaño de los números con módulo de 0,33 mm (se achica con el módulo). */
const DIGITS_PT_AT_100 = 8;

/** Mide el ancho de un texto en mm (lo da pdf-lib, con Helvetica real). */
export type Measure = (text: string, sizePt: number, bold: boolean) => number;

// ---------------------------------------------------------------------
// Legibilidad del código de barras
// ---------------------------------------------------------------------
/** Módulo nominal EAN-13 (100 %): 0,33 mm. */
const X_NOMINAL = 0.33;
/** Mínimo aceptado por el estándar (80 %). Más chico = cuesta leerlo. */
const X_MIN = 0.264;
/** Alto mínimo de las barras para que lo lea bien una cámara o un lector. */
const MIN_BAR_H = 8;

export type Geometry = {
  /** Tamaño de cada etiqueta (sin la franja de título). */
  labelW: number;
  labelH: number;
  /** Ancho del módulo (la barra más fina) en mm. */
  moduleX: number;
  /** Tamaño respecto del nominal (100 % = 0,33 mm). */
  magnification: number;
  barH: number;
  /** null = se puede imprimir; si no, por qué no. */
  problem: string | null;
};

/** Medidas de cada etiqueta y del código según la grilla elegida. */
export function computeGeometry(settings: LabelSettings): Geometry {
  const labelW = (PAGE_W - 2 * MARGIN_X) / settings.columns;
  const labelH = (PAGE_H - 2 * MARGIN_Y) / settings.rows - BAND_H;
  // El código con sus zonas en blanco (113 módulos) tiene que entrar en el ancho útil
  const moduleX = Math.min(X_NOMINAL, (labelW - 2 * PAD) / EAN13_TOTAL_MODULES);
  const barH = barsBox(0, labelH, moduleX).barH;

  let problem: string | null = null;
  if (moduleX < X_MIN) problem = "Las etiquetas quedan muy angostas para un código legible. Elegí menos columnas.";
  else if (barH < MIN_BAR_H) problem = "Las etiquetas quedan muy bajas para un código legible. Elegí menos filas.";

  return { labelW, labelH, moduleX, magnification: Math.round((moduleX / X_NOMINAL) * 100), barH, problem };
}

/** Posiciones verticales dentro de una etiqueta (desde su borde superior `top`). */
function barsBox(top: number, labelH: number, moduleX: number) {
  const digitsPt = DIGITS_PT_AT_100 * (moduleX / X_NOMINAL);
  const nameBaseline = top + PAD + NAME_PT * PT * CAP_HEIGHT;
  const variantBaseline = nameBaseline + 1.0 + VARIANT_PT * PT * CAP_HEIGHT;
  const barTop = variantBaseline + 1.2;
  const digitsBaseline = top + labelH - PAD;
  const barBottom = digitsBaseline - digitsPt * PT * CAP_HEIGHT - 0.4;
  return { nameBaseline, variantBaseline, barTop, barBottom, barH: barBottom - barTop, digitsBaseline, digitsPt };
}

// ---------------------------------------------------------------------
// Resultado: lo que hay que dibujar en cada hoja
// ---------------------------------------------------------------------
export type SheetText = {
  text: string;
  /** Borde IZQUIERDO del texto (ya centrado, si correspondía). */
  x: number;
  /** Línea de base (donde "se apoyan" las letras). */
  y: number;
  sizePt: number;
  bold: boolean;
  /** Gris para lo que no es la etiqueta en sí (títulos y pie). */
  muted: boolean;
};

export type SheetBarcode = {
  code: string;
  /** Borde izquierdo de la guarda inicial (sin la zona en blanco). */
  x: number;
  top: number;
  moduleX: number;
  barH: number;
  /** Cuánto más bajan las guardas. */
  guardExtra: number;
};

export type CutLine = { x1: number; y1: number; x2: number; y2: number };

export type SheetPage = {
  texts: SheetText[];
  barcodes: SheetBarcode[];
  cuts: CutLine[];
  labelCount: number;
};

/** Un grupo = una variante con su cantidad. */
export type LabelGroup = {
  productName: string;
  variantLabel: string | null;
  barcode: string;
  quantity: number;
};

export type SheetsResult = {
  pages: SheetPage[];
  total: number;
  geometry: Geometry;
};

/**
 * Arma todas las hojas.
 *
 * Reglas:
 *   - El primer grupo empieza en la posición `startAt` (para reaprovechar
 *     una hoja ya usada). Los demás, siempre en una fila nueva.
 *   - Cada grupo lleva su título en la franja de la fila donde empieza.
 *     Si sigue en otra hoja, el título se repite con "(cont.)".
 */
export function buildSheets(groups: LabelGroup[], settings: LabelSettings, measure: Measure): SheetsResult {
  const geometry = computeGeometry(settings);
  const { columns, rows } = settings;
  const perPage = columns * rows;
  const rowH = (PAGE_H - 2 * MARGIN_Y) / rows;

  const pages: SheetPage[] = [];
  const pageAt = (index: number) => {
    while (pages.length <= index) pages.push({ texts: [], barcodes: [], cuts: [], labelCount: 0 });
    return pages[index];
  };
  // Celdas ocupadas por hoja (para dibujar los cortes solo donde hay etiquetas)
  const usedCells: { col: number; row: number }[][] = [];

  let pos = settings.startAt - 1; // posición global (cuenta todas las hojas)
  let total = 0;

  groups.forEach((group, gi) => {
    if (group.quantity <= 0) return;
    // Cada grupo (menos el primero) empieza en una fila nueva
    if (gi > 0 && pos % columns !== 0) pos += columns - (pos % columns);

    const title = `${shortName(group)} (${group.quantity})`;
    for (let i = 0; i < group.quantity; i++, pos++) {
      const pageIndex = Math.floor(pos / perPage);
      const inPage = pos % perPage;
      const col = inPage % columns;
      const row = Math.floor(inPage / columns);
      const page = pageAt(pageIndex);
      (usedCells[pageIndex] ??= []).push({ col, row });

      const cellX = MARGIN_X + col * geometry.labelW;
      const rowY = MARGIN_Y + row * rowH;
      const cellY = rowY + BAND_H;

      // Título: al empezar el grupo, o al pasar a una hoja nueva
      if (i === 0 || inPage === 0) {
        const text = fit(i === 0 ? title : `${title} (cont.)`, PAGE_W - MARGIN_X - cellX - PAD, TITLE_PT, true, measure);
        page.texts.push({ text, x: cellX + PAD, y: rowY + BAND_H - 0.9, sizePt: TITLE_PT, bold: true, muted: true });
      }

      drawLabel(page, group, cellX, cellY, geometry, measure);
      page.labelCount++;
      total++;
    }
  });

  pages.forEach((page, index) => {
    page.cuts = cutLines(usedCells[index] ?? [], geometry, rowH);
    const footer = `Home Deko · Etiquetas · Hoja ${index + 1} de ${pages.length}`;
    page.texts.push({
      text: footer,
      x: PAGE_W - MARGIN_X - measure(footer, FOOTER_PT, false),
      y: PAGE_H - MARGIN_Y + 3.5,
      sizePt: FOOTER_PT,
      bold: false,
      muted: true,
    });
  });

  return { pages, total, geometry };
}

/** "Taza – Rojo / 300 ml" o solo "Taza". */
function shortName(group: LabelGroup): string {
  return group.variantLabel ? `${group.productName} – ${group.variantLabel}` : group.productName;
}

/** Una etiqueta: nombre, variante, barras y números. */
function drawLabel(page: SheetPage, group: LabelGroup, x: number, y: number, g: Geometry, measure: Measure) {
  const box = barsBox(y, g.labelH, g.moduleX);
  const innerW = g.labelW - 2 * PAD;
  const centerX = x + g.labelW / 2;

  const centered = (text: string, baseline: number, sizePt: number, bold: boolean) => {
    const fitted = fit(text, innerW, sizePt, bold, measure);
    if (!fitted) return;
    page.texts.push({
      text: fitted,
      x: centerX - measure(fitted, sizePt, bold) / 2,
      y: baseline,
      sizePt,
      bold,
      muted: false,
    });
  };

  centered(group.productName, box.nameBaseline, NAME_PT, true);
  if (group.variantLabel) centered(group.variantLabel, box.variantBaseline, VARIANT_PT, false);

  // El código con sus zonas en blanco, centrado en la etiqueta
  const blockLeft = centerX - (EAN13_TOTAL_MODULES * g.moduleX) / 2;
  const barsX = blockLeft + QUIET_LEFT * g.moduleX;
  page.barcodes.push({
    code: group.barcode,
    x: barsX,
    top: box.barTop,
    moduleX: g.moduleX,
    barH: box.barH,
    guardExtra: 5 * g.moduleX,
  });

  // Números: 1 afuera a la izquierda + 6 + 6 (formato estándar)
  const centers = ean13DigitCenters();
  [...group.barcode].forEach((digit, i) => {
    page.texts.push({
      text: digit,
      x: barsX + centers[i] * g.moduleX - measure(digit, box.digitsPt, false) / 2,
      y: box.digitsBaseline,
      sizePt: box.digitsPt,
      bold: false,
      muted: false,
    });
  });
}

/**
 * Recorta un texto con "…" para que entre en `maxW` mm.
 * (Se mide con la tipografía real, así la vista previa y el PDF cortan igual.)
 */
function fit(text: string, maxW: number, sizePt: number, bold: boolean, measure: Measure): string {
  const clean = toWinAnsi(text).replace(/\s+/g, " ").trim();
  if (measure(clean, sizePt, bold) <= maxW) return clean;
  let lo = 0;
  let hi = clean.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (measure(`${clean.slice(0, mid).trimEnd()}…`, sizePt, bold) <= maxW) lo = mid;
    else hi = mid - 1;
  }
  return lo === 0 ? "" : `${clean.slice(0, lo).trimEnd()}…`;
}

/**
 * Líneas punteadas de corte alrededor de las celdas usadas. Los bordes
 * compartidos se dibujan una sola vez y los tramos seguidos se unen en
 * una sola línea (así la punteada queda pareja).
 */
function cutLines(cells: { col: number; row: number }[], g: Geometry, rowH: number): CutLine[] {
  const horizontal = new Map<number, [number, number][]>(); // y → tramos [x1, x2]
  const vertical = new Map<number, [number, number][]>(); // x → tramos [y1, y2]
  const seen = new Set<string>();
  const add = (map: Map<number, [number, number][]>, at: number, from: number, to: number) => {
    const key = `${map === horizontal ? "h" : "v"}:${at.toFixed(3)}:${from.toFixed(3)}`;
    if (seen.has(key)) return;
    seen.add(key);
    const list = map.get(at) ?? [];
    list.push([from, to]);
    map.set(at, list);
  };

  for (const { col, row } of cells) {
    const x1 = MARGIN_X + col * g.labelW;
    const x2 = x1 + g.labelW;
    const y1 = MARGIN_Y + row * rowH + BAND_H;
    const y2 = y1 + g.labelH;
    add(horizontal, round(y1), x1, x2);
    add(horizontal, round(y2), x1, x2);
    add(vertical, round(x1), y1, y2);
    add(vertical, round(x2), y1, y2);
  }

  const lines: CutLine[] = [];
  for (const [y, spans] of horizontal) for (const [a, b] of merge(spans)) lines.push({ x1: a, y1: y, x2: b, y2: y });
  for (const [x, spans] of vertical) for (const [a, b] of merge(spans)) lines.push({ x1: x, y1: a, x2: x, y2: b });
  return lines;
}

const round = (n: number) => Math.round(n * 1000) / 1000;

function merge(spans: [number, number][]): [number, number][] {
  const sorted = [...spans].sort((a, b) => a[0] - b[0]);
  const out: [number, number][] = [];
  for (const [a, b] of sorted) {
    const last = out[out.length - 1];
    if (last && a <= last[1] + 0.001) last[1] = Math.max(last[1], b);
    else out.push([a, b]);
  }
  return out;
}

// ---------------------------------------------------------------------
// Caracteres que entiende Helvetica en un PDF ("WinAnsi")
// ---------------------------------------------------------------------
const WIN_ANSI_EXTRA = new Set([..."€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ"]);

/**
 * Deja solo caracteres que Helvetica puede escribir en el PDF.
 * Tildes, ñ, Ø, ½, – y comillas tipográficas quedan igual; lo demás se
 * simplifica ("ă" → "a") o se cambia por "?" (ej.: un emoji).
 */
export function toWinAnsi(text: string): string {
  let out = "";
  for (const ch of text.normalize("NFC")) {
    const code = ch.codePointAt(0) ?? 0;
    if ((code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff) || WIN_ANSI_EXTRA.has(ch)) out += ch;
    else if (code === 0x09 || code === 0x0a || code === 0x0d) out += " ";
    else {
      const plain = ch.normalize("NFD").replace(/[̀-ͯ]/g, "");
      out += /^[\x20-\x7e]+$/.test(plain) ? plain : "?";
    }
  }
  return out;
}
