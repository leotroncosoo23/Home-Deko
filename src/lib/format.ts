/**
 * Formato de números y plata en español (Argentina).
 *   formatARS(12345.6)        → "$ 12.345,60"
 *   formatMoneyInput(12345.6) → "12.345,60"   (para mostrar dentro de un campo)
 *   parseMoney("12.345,60")   → 12345.6
 */

const ars = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** "$ 12.345,67" (para mostrar precios). */
export function formatARS(value: number): string {
  // Intl pone un espacio "duro" entre $ y el número; lo dejamos normal.
  return ars.format(value).replace(/ /g, " ");
}

const arsWhole = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/**
 * Precio para CLIENTES (tienda, carrito, checkout, pedido y mails):
 * "$ 25.000" sin ",00"; si tiene centavos reales, se muestran ("$ 25.000,50").
 * El panel sigue con formatARS (siempre con centavos, columnas alineadas).
 */
export function formatPrice(value: number): string {
  const cents = Math.round(value * 100);
  const text = cents % 100 === 0 ? arsWhole.format(cents / 100) : ars.format(value);
  // Intl pone un espacio "duro" (U+00A0) entre $ y el número; lo dejamos normal.
  return text.replace(/ /g, " ");
}

/**
 * "Precio sin impuestos nacionales" (opcional, se prende en la
 * Configuración): precio / (1 + %/100), redondeado a pesos.
 */
export function priceWithoutTaxes(price: number, taxPercent: number): number {
  return Math.round(price / (1 + taxPercent / 100));
}

/** "12.345" o "12.345,50" (sin $; para el valor de un campo). */
export function formatMoneyInput(value: number | null): string {
  if (value === null || Number.isNaN(value)) return "";
  const hasCents = Math.round(value * 100) % 100 !== 0;
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Lee un monto escrito como lo escribe una persona en Argentina.
 *   ""            → null (vacío)
 *   "12.345,67"   → 12345.67   (punto = miles, coma = decimales)
 *   "12345,5"     → 12345.5
 *   "12.500"      → 12500      (punto seguido de 3 dígitos = miles)
 *   "12.5"        → 12.5       (alguien que usó punto decimal)
 *   "abc"         → NaN        (inválido)
 * Redondea a centavos.
 */
export function parseMoney(text: string): number | null {
  let s = text.replace(/[\s$]/g, "");
  if (s === "") return null;

  if (s.includes(",")) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, "");
  }

  if (!/^\d+(\.\d+)?$/.test(s)) return NaN;
  return Math.round(Number(s) * 100) / 100;
}

/** "20123456786" → "20-12345678-6" (si no son 11 dígitos, lo deja como está). */
export function formatCuit(digits: string): string {
  return /^\d{11}$/.test(digits) ? `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}` : digits;
}

// ---------------------------------------------------------------------------
// Nombres y lugares para MOSTRAR (lo guardado en la base no cambia)
// ---------------------------------------------------------------------------

/** Palabras que van en minúscula en medio de un nombre ("María de los Ángeles", "Santiago del Estero"). */
const LOWER_WORDS = new Set(["de", "del", "la", "las", "los", "y", "e", "da", "das", "do", "dos", "di", "van", "von"]);
/** Siglas que se dejan en mayúscula aunque el cliente haya escrito todo en mayúsculas. */
const KEEP_UPPER = new Set(["CABA", "CP", "SRL", "SA"]);

/**
 * Mayúscula inicial en cada palabra, para nombres, ciudades y provincias:
 *   "leonardo troncoso"          → "Leonardo Troncoso"
 *   "MARIA DE LOS ANGELES"       → "Maria de los Angeles"
 *   "jose-luis o'connor"         → "Jose-Luis O'Connor"
 *   "san carlos de bariloche"    → "San Carlos de Bariloche"
 * Lo que ya viene con mayúsculas y minúsculas mezcladas ("McDonald") se respeta.
 * La primera palabra siempre va con mayúscula ("La Pampa", "De la Fuente").
 */
export function titleCase(text: string | null | undefined): string {
  const clean = (text ?? "").trim().replace(/\s+/g, " ");
  if (!clean) return "";
  const allUpper = clean === clean.toLocaleUpperCase("es-AR");
  return clean
    .split(" ")
    .map((word, i) => {
      const lower = word.toLocaleLowerCase("es-AR");
      const upper = word.toLocaleUpperCase("es-AR");
      if (KEEP_UPPER.has(upper) && word === upper) return upper;
      // Mezcla de mayúsculas y minúsculas: la escribió así a propósito
      if (word !== lower && word !== upper) return word;
      // Una sigla corta en mayúsculas dentro de un texto normal ("Barrio YPF"): se deja
      if (word === upper && word !== lower && !allUpper && word.length <= 4) return word;
      if (i > 0 && LOWER_WORDS.has(lower)) return lower;
      // Mayúscula al principio y después de guion o apóstrofo
      return lower.replace(/(^|[-'’])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toLocaleUpperCase("es-AR"));
    })
    .join(" ");
}

/** Primer nombre, con mayúscula ("leonardo troncoso" → "Leonardo"). */
export function firstNameOf(name: string): string {
  return titleCase(name).split(" ")[0] ?? "";
}

/**
 * WhatsApp guardado (solo dígitos) → "+54 9 2945123456" para mostrar.
 * (La característica puede tener 2, 3 o 4 dígitos: no se adivina dónde cortar.)
 */
export function formatWhatsApp(digits: string): string {
  const d = digits.replace(/\D/g, "");
  if (d.startsWith("549") && d.length >= 12) return `+54 9 ${d.slice(3)}`;
  return d ? `+${d}` : "";
}

/** Lee un entero no negativo ("" → null, "12" → 12, "1.200" → 1200). */
export function parseInteger(text: string): number | null {
  const s = text.replace(/[\s.]/g, "");
  if (s === "") return null;
  if (!/^\d+$/.test(s)) return NaN;
  return Number(s);
}
