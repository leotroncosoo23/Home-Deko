/**
 * Períodos del Inicio del panel, en DÍAS de Argentina ("2026-11-24").
 *
 * Todo está en la URL:
 *   /admin?periodo=mes&agrupar=semana
 *   /admin?periodo=personalizado&desde=2026-10-01&hasta=2026-10-15
 *
 * La base (admin_dashboard) recibe 4 días: el período y el anterior con el que
 * se compara. Acá se decide cuál es ese "anterior" para que la comparación sea
 * justa (ej.: "Este mes" del 1 al 24 se compara con el 1 al 24 del mes pasado).
 *
 * Funciones puras: la fecha de "hoy" llega de afuera (todayInArgentina()).
 * Las cuentas de días se hacen en UTC a propósito: un día "2026-11-24" no tiene
 * hora ni zona, así no hay corrimientos por la hora del servidor.
 */

export const PERIODS = {
  hoy: "Hoy",
  "7d": "7 días",
  "30d": "30 días",
  mes: "Este mes",
  "mes-anterior": "Mes anterior",
  anio: "Este año",
  personalizado: "Personalizado",
} as const;
export type PeriodKey = keyof typeof PERIODS;

export const DEFAULT_PERIOD: PeriodKey = "30d";

/** Cómo se agrupa el gráfico (nombre en la URL → valor para la base). */
export const BUCKETS = { dia: "Día", semana: "Semana", mes: "Mes" } as const;
export type BucketKey = keyof typeof BUCKETS;
export const BUCKET_SQL: Record<BucketKey, "day" | "week" | "month"> = { dia: "day", semana: "week", mes: "month" };

/** Límites (los mismos que valida admin_dashboard en la base). */
export const MAX_PERIOD_DAYS = 731; // 2 años
export const MAX_DAILY_DAYS = 92; // por día, hasta ~3 meses

export type Period = {
  key: PeriodKey;
  from: string;
  to: string;
  prevFrom: string;
  prevTo: string;
  /** Cantidad de días del período (1 = un solo día). */
  days: number;
  bucket: BucketKey;
  /** Agrupaciones que tienen sentido para este largo (para el selector). */
  buckets: BucketKey[];
  /** "1 nov. – 24 nov. 2026" */
  label: string;
  /** "vs. ayer", "vs. octubre"… (va al lado de cada variación) */
  compareLabel: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

// ---------------------------------------------------------------------------
// Días (texto "AAAA-MM-DD") sin zona horaria
// ---------------------------------------------------------------------------

/** Hoy en Argentina ("2026-11-24"). */
export function todayInArgentina(now: Date = new Date()): string {
  return now.toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
}

function toUtc(day: string): number {
  const [y, m, d] = day.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function fromUtc(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(day: string, n: number): string {
  return fromUtc(toUtc(day) + n * DAY_MS);
}

/** Días entre dos fechas, contando las dos ("2026-11-01".."2026-11-01" = 1). */
export function daysInclusive(from: string, to: string): number {
  return Math.round((toUtc(to) - toUtc(from)) / DAY_MS) + 1;
}

/** ¿Es un día real? ("2026-02-30" no lo es) */
export function isValidDay(day: string | undefined | null): day is string {
  if (!day || !DAY_RE.test(day)) return false;
  return fromUtc(toUtc(day)) === day;
}

function parts(day: string) {
  const [y, m, d] = day.split("-").map(Number);
  return { y, m, d };
}

function makeDay(y: number, m: number, d: number): string {
  // Date.UTC acomoda meses fuera de rango (m = 0 → diciembre del año anterior)
  return fromUtc(Date.UTC(y, m - 1, d));
}

function lastDayOfMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** El mismo día en otro mes, sin pasarse (31 de marzo → 28/29 de febrero). */
function sameDayInMonth(y: number, m: number, d: number): string {
  const first = makeDay(y, m, 1);
  const { y: yy, m: mm } = parts(first);
  return makeDay(yy, mm, Math.min(d, lastDayOfMonth(yy, mm)));
}

// ---------------------------------------------------------------------------
// Textos
// ---------------------------------------------------------------------------

const AR = "America/Argentina/Buenos_Aires";
/** Un día a mediodía de Argentina: así el formato nunca cae en el día de al lado. */
const atNoon = (day: string) => new Date(`${day}T12:00:00-03:00`);

const monthName = (day: string) => atNoon(day).toLocaleDateString("es-AR", { month: "long", timeZone: AR });

/** "24 nov. 2026" o "24 nov." (sin año) */
export function shortDay(day: string, withYear = true): string {
  return atNoon(day).toLocaleDateString("es-AR", {
    day: "numeric",
    month: "short",
    ...(withYear ? { year: "numeric" } : {}),
    timeZone: AR,
  });
}

function rangeLabel(from: string, to: string): string {
  if (from === to) return shortDay(from);
  const sameYear = from.slice(0, 4) === to.slice(0, 4);
  return `${shortDay(from, !sameYear)} – ${shortDay(to)}`;
}

// ---------------------------------------------------------------------------
// Agrupación del gráfico
// ---------------------------------------------------------------------------

/** Agrupaciones posibles para un período de N días. Un solo día: ninguna (no hay gráfico). */
export function bucketsFor(days: number): BucketKey[] {
  const list: BucketKey[] = [];
  if (days >= 2 && days <= MAX_DAILY_DAYS) list.push("dia");
  if (days >= 14) list.push("semana");
  if (days >= 60) list.push("mes");
  return list;
}

/** La que se elige sola: por día hasta un mes, por semana hasta ~4 meses, después por mes. */
export function autoBucket(days: number): BucketKey {
  if (days <= 31) return "dia";
  if (days <= 120) return "semana";
  return "mes";
}

// ---------------------------------------------------------------------------
// Parseo de la URL
// ---------------------------------------------------------------------------

type RawParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Arma el período desde la URL. Cualquier cosa rara → el período por defecto (30 días). */
export function parsePeriod(raw: RawParams, today: string): Period {
  const requested = first(raw.periodo);
  const key: PeriodKey = requested && requested in PERIODS ? (requested as PeriodKey) : DEFAULT_PERIOD;
  const range = rangeFor(key, today, first(raw.desde), first(raw.hasta));

  const days = daysInclusive(range.from, range.to);
  const buckets = bucketsFor(days);
  const wanted = first(raw.agrupar) as BucketKey | undefined;
  const auto = autoBucket(days);
  const bucket = wanted && buckets.includes(wanted) ? wanted : auto;

  return {
    key,
    ...range,
    days,
    bucket,
    buckets,
    label: rangeLabel(range.from, range.to),
  };
}

function rangeFor(
  key: PeriodKey,
  today: string,
  desde: string | undefined,
  hasta: string | undefined,
): Pick<Period, "from" | "to" | "prevFrom" | "prevTo" | "compareLabel"> {
  const { y, m, d } = parts(today);

  switch (key) {
    case "hoy":
      return { from: today, to: today, prevFrom: addDays(today, -1), prevTo: addDays(today, -1), compareLabel: "vs. ayer" };

    case "7d":
    case "30d": {
      const n = key === "7d" ? 7 : 30;
      const from = addDays(today, -(n - 1));
      return {
        from,
        to: today,
        prevFrom: addDays(from, -n),
        prevTo: addDays(from, -1),
        compareLabel: `vs. los ${n} días anteriores`,
      };
    }

    case "mes": {
      // Del 1 a hoy, contra los mismos días del mes pasado (1 al 24 vs. 1 al 24)
      const prevFrom = makeDay(y, m - 1, 1);
      return {
        from: makeDay(y, m, 1),
        to: today,
        prevFrom,
        prevTo: sameDayInMonth(y, m - 1, d),
        compareLabel: `vs. mismos días de ${monthName(prevFrom)}`,
      };
    }

    case "mes-anterior": {
      const from = makeDay(y, m - 1, 1);
      const to = addDays(makeDay(y, m, 1), -1);
      const prevFrom = makeDay(y, m - 2, 1);
      return { from, to, prevFrom, prevTo: addDays(from, -1), compareLabel: `vs. ${monthName(prevFrom)}` };
    }

    case "anio": {
      // Del 1/1 a hoy, contra el mismo tramo del año pasado (29/2 → 28/2)
      return {
        from: makeDay(y, 1, 1),
        to: today,
        prevFrom: makeDay(y - 1, 1, 1),
        prevTo: sameDayInMonth(y - 1, m, d),
        compareLabel: `vs. mismo tramo de ${y - 1}`,
      };
    }

    case "personalizado": {
      // Fechas inválidas o vacías → los últimos 30 días (y el formulario las muestra)
      let to = isValidDay(hasta) ? hasta : today;
      let from = isValidDay(desde) ? desde : addDays(to, -29);
      if (from > to) [from, to] = [to, from]; // las cargaron al revés
      if (to > today) to = today; // nada en el futuro
      if (from > to) from = to;
      if (daysInclusive(from, to) > MAX_PERIOD_DAYS) from = addDays(to, -(MAX_PERIOD_DAYS - 1));
      const n = daysInclusive(from, to);
      return {
        from,
        to,
        prevFrom: addDays(from, -n),
        prevTo: addDays(from, -1),
        compareLabel: n === 1 ? "vs. el día anterior" : `vs. los ${n} días anteriores`,
      };
    }
  }
}

/** Link a /admin con otro período o agrupación (lo demás se conserva). */
export function periodHref(
  current: Pick<Period, "key" | "from" | "to">,
  change: { periodo?: PeriodKey; agrupar?: BucketKey },
): string {
  const key = change.periodo ?? current.key;
  const search = new URLSearchParams();
  if (key !== DEFAULT_PERIOD) search.set("periodo", key);
  if (key === "personalizado") {
    search.set("desde", current.from);
    search.set("hasta", current.to);
  }
  if (change.agrupar) search.set("agrupar", change.agrupar);
  const qs = search.toString();
  return qs ? `/admin?${qs}` : "/admin";
}

// ---------------------------------------------------------------------------
// Variación contra el período anterior
// ---------------------------------------------------------------------------

export type Change =
  | { kind: "none" } // 0 y 0: no se muestra nada (nunca "▼ 100 %" con todo vacío)
  | { kind: "new" } // antes 0, ahora algo
  | { kind: "pct"; value: number }; // entero, con signo

export function changeBetween(current: number, previous: number): Change {
  if (previous === 0) return current === 0 ? { kind: "none" } : { kind: "new" };
  return { kind: "pct", value: Math.round(((current - previous) / previous) * 100) };
}
