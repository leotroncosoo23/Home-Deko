/**
 * Código de barras EAN-13, sin librerías.
 *
 * Un EAN-13 son 95 "módulos" (franjas finitas del mismo ancho), cada uno
 * negro (1) o blanco (0):
 *
 *   101  +  6 dígitos (42 módulos)  +  01010  +  6 dígitos (42)  +  101
 *   └ guarda inicial                   └ guarda central             └ guarda final
 *
 * - El PRIMER dígito no se dibuja con barras: decide qué "juego" (L o G)
 *   usa cada uno de los 6 dígitos de la izquierda (tabla PARITY).
 * - Los 6 de la derecha siempre usan el juego R.
 * - Cada dígito ocupa 7 módulos.
 *
 * Además, el lector necesita "zonas en blanco" a los costados: 11 módulos
 * a la izquierda y 7 a la derecha (QUIET_LEFT / QUIET_RIGHT).
 */

/** Juego L (lado izquierdo, "impar"). Índice = dígito. */
const L = ["0001101", "0011001", "0010011", "0111101", "0100011", "0110001", "0101111", "0111011", "0110111", "0001011"];
/** Juego G (lado izquierdo, "par") = R al revés. */
const G = ["0100111", "0110011", "0011011", "0100001", "0011101", "0111001", "0000101", "0010001", "0001001", "0010111"];
/** Juego R (lado derecho) = L invertido (negro ↔ blanco). */
const R = ["1110010", "1100110", "1101100", "1000010", "1011100", "1001110", "1010000", "1000100", "1001000", "1110100"];

/** Según el primer dígito: qué juego usa cada dígito de la izquierda. */
const PARITY = ["LLLLLL", "LLGLGG", "LLGGLG", "LLGGGL", "LGLLGG", "LGGLLG", "LGGGLL", "LGLGLG", "LGLGGL", "LGGLGL"];

export const EAN13_MODULES = 95;
export const QUIET_LEFT = 11;
export const QUIET_RIGHT = 7;
/** Ancho total que necesita el símbolo, contando las zonas en blanco. */
export const EAN13_TOTAL_MODULES = QUIET_LEFT + EAN13_MODULES + QUIET_RIGHT; // 113

/**
 * Dígito verificador de los 12 primeros dígitos.
 * Posiciones 1ª, 3ª, 5ª… valen x1; 2ª, 4ª, 6ª… valen x3 (igual que
 * generate_ean13() en la base).
 */
export function ean13CheckDigit(first12: string): number {
  let total = 0;
  for (let i = 0; i < 12; i++) total += Number(first12[i]) * (i % 2 === 0 ? 1 : 3);
  return (10 - (total % 10)) % 10;
}

/** ¿Son 13 dígitos con el verificador correcto? */
export function isValidEan13(code: string): boolean {
  return /^\d{13}$/.test(code) && ean13CheckDigit(code.slice(0, 12)) === Number(code[12]);
}

/** Los 95 módulos como texto de "0" y "1". */
export function ean13Modules(code: string): string {
  if (!isValidEan13(code)) throw new Error(`Código EAN-13 inválido: ${code}`);
  const d = [...code].map(Number);
  const parity = PARITY[d[0]];
  let out = "101";
  for (let i = 1; i <= 6; i++) out += (parity[i - 1] === "L" ? L : G)[d[i]];
  out += "01010";
  for (let i = 7; i <= 12; i++) out += R[d[i]];
  return out + "101";
}

/** Una barra negra: desde el módulo `x`, de `width` módulos de ancho. */
export type Bar = { x: number; width: number; /** Barra de guarda (se dibuja más larga). */ guard: boolean };

/** Módulos que pertenecen a las guardas (inicial, central y final). */
function isGuardModule(i: number): boolean {
  return i < 3 || (i >= 45 && i < 50) || i >= 92;
}

/**
 * Las barras negras del código, juntando módulos negros seguidos en una
 * sola barra (menos rectángulos para dibujar = PDF más liviano y nítido).
 */
export function ean13Bars(code: string): Bar[] {
  const modules = ean13Modules(code);
  const bars: Bar[] = [];
  let i = 0;
  while (i < modules.length) {
    if (modules[i] === "0") {
      i++;
      continue;
    }
    const start = i;
    while (i < modules.length && modules[i] === "1" && isGuardModule(i) === isGuardModule(start)) i++;
    bars.push({ x: start, width: i - start, guard: isGuardModule(start) });
  }
  return bars;
}

/**
 * Dónde va cada número debajo de las barras (centro, en módulos desde la
 * guarda inicial). Formato estándar: 1 dígito afuera a la izquierda,
 * 6 bajo la mitad izquierda y 6 bajo la mitad derecha.
 */
export function ean13DigitCenters(): number[] {
  const centers = [-6]; // el primero, dentro de la zona en blanco izquierda
  for (let i = 0; i < 6; i++) centers.push(3 + 7 * i + 3.5);
  for (let i = 0; i < 6; i++) centers.push(50 + 7 * i + 3.5);
  return centers;
}
