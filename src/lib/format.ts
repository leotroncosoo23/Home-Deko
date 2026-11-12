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

/** Lee un entero no negativo ("" → null, "12" → 12, "1.200" → 1200). */
export function parseInteger(text: string): number | null {
  const s = text.replace(/[\s.]/g, "");
  if (s === "") return null;
  if (!/^\d+$/.test(s)) return NaN;
  return Number(s);
}
