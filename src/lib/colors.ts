import { slugify } from "./slug";

/**
 * Colores comunes → muestra sugerida. Cuando escriben "Rojo" en la opción
 * Color, el circulito se pinta solo (y lo pueden cambiar).
 * Las claves están "normalizadas" (sin tildes, minúsculas, con guiones).
 */
const COMMON_COLORS: Record<string, string> = {
  blanco: "#FFFFFF",
  "blanco-roto": "#F4F1EA",
  negro: "#1A1A1A",
  gris: "#8A8A8A",
  "gris-claro": "#CFCFCF",
  "gris-oscuro": "#4A4A4A",
  grafito: "#3B3B3B",
  rojo: "#C62828",
  bordo: "#6D1A2A",
  terracota: "#C8643C",
  naranja: "#EF7D22",
  mostaza: "#D4A017",
  amarillo: "#F2C94C",
  dorado: "#C9A54B",
  plateado: "#C0C0C0",
  cobre: "#B87333",
  beige: "#E8DCC4",
  crema: "#F3EBD8",
  arena: "#D8C3A0",
  natural: "#D9C7A7",
  marron: "#6D4C3D",
  chocolate: "#4E342E",
  madera: "#A1754F",
  verde: "#2E7D32",
  "verde-oliva": "#6B7B3A",
  "verde-agua": "#8FD6C6",
  "verde-musgo": "#5B6B3A",
  salvia: "#9CAF88",
  turquesa: "#1FB5AD",
  celeste: "#7EC8E3",
  azul: "#1E5AA8",
  "azul-marino": "#1F2A44",
  petroleo: "#1D4E5F",
  violeta: "#7B4FA0",
  lila: "#B79FD6",
  rosa: "#F4A6B8",
  "rosa-viejo": "#C9939B",
  fucsia: "#D6247F",
  coral: "#F2786B",
};

/** "Rojo" → "#C62828"; "Azul marino" → "#1F2A44"; desconocido → null. */
export function suggestColorHex(name: string): string | null {
  const key = slugify(name);
  if (COMMON_COLORS[key]) return COMMON_COLORS[key];
  // "Rojo mate", "Negro brillante" → probar con la primera palabra
  const first = key.split("-")[0];
  return COMMON_COLORS[first] ?? null;
}

/** ¿La opción es la de color? ("Color", "Colores", "color") */
export function isColorOption(name: string): boolean {
  return ["color", "colores"].includes(slugify(name));
}
