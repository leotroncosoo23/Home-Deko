/**
 * Fechas en hora de Argentina (UTC−3 todo el año, sin horario de verano).
 *
 * Los formularios del panel trabajan con DÍAS ("2026-12-01"); la base
 * guarda INSTANTES (timestamptz). Estas funciones convierten entre los dos.
 * Las usan el descuento de los productos y las fechas de los banners.
 */

const AR_OFFSET = "-03:00";
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/** "2026-12-01" → 00:00 de ese día en Argentina (o null si está vacío). */
export function dayStartToIso(day: string): string | null {
  return day ? `${day}T00:00:00${AR_OFFSET}` : null;
}

/** "2026-12-01" → 23:59:59 de ese día en Argentina (o null si está vacío). */
export function dayEndToIso(day: string): string | null {
  return day ? `${day}T23:59:59${AR_OFFSET}` : null;
}

/**
 * "2026-12-25" → 00:00 del día SIGUIENTE (26/12) en Argentina.
 * Los banners guardan así el fin: "hasta el 25" = se apaga al empezar el 26.
 */
export function dayAfterStartToIso(day: string): string | null {
  if (!day) return null;
  const start = new Date(`${day}T00:00:00${AR_OFFSET}`).getTime();
  return new Date(start + ONE_DAY_MS).toISOString();
}

/** Un instante → el día en Argentina ("2026-12-01"). */
export function isoToArgentinaDay(iso: string | null): string {
  if (!iso) return "";
  // "en-CA" escribe las fechas como AAAA-MM-DD.
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
}

/** El fin guardado como "00:00 del día siguiente" → el último día que se ve. */
export function exclusiveEndToArgentinaDay(iso: string | null): string {
  if (!iso) return "";
  return isoToArgentinaDay(new Date(new Date(iso).getTime() - 1000).toISOString());
}

/** "2026-12-01" → "1 dic. 2026" (para mostrar). */
export function formatArgentinaDay(day: string): string {
  if (!day) return "";
  return new Date(`${day}T12:00:00${AR_OFFSET}`).toLocaleDateString("es-AR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "America/Argentina/Buenos_Aires",
  });
}
