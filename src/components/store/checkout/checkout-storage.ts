/**
 * Comodidades del checkout guardadas en ESTE navegador (localStorage).
 * Nada de esto es importante: si el navegador no deja guardar (modo
 * privado, bloqueado), todo funciona igual, solo que sin recordar.
 *
 *   hd_datos_compra   → nombre, email, teléfono y dirección (con piso/depto
 *                       e indicaciones), para no
 *                       volver a escribirlos en la próxima compra.
 *   hd_ultimo_pedido  → link al último pedido iniciado (por si el cliente
 *                       vuelve de Mercado Pago con "atrás").
 *   hd_carrito_vaciado → último pedido aprobado por el que ya se vació el
 *                       carrito (para no vaciarlo otra vez si recarga).
 */

const CUSTOMER_KEY = "hd_datos_compra";
const LAST_ORDER_KEY = "hd_ultimo_pedido";
const CLEARED_KEY = "hd_carrito_vaciado";

export type SavedCustomer = {
  name: string;
  email: string;
  phone: string;
  delivery: "" | "shipping" | "pickup";
  address: string;
  apartment: string;
  notes: string;
  city: string;
  province: string;
  postalCode: string;
};

export const EMPTY_CUSTOMER: SavedCustomer = {
  name: "",
  email: "",
  phone: "",
  delivery: "",
  address: "",
  apartment: "",
  notes: "",
  city: "",
  province: "",
  postalCode: "",
};

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Sin almacenamiento: no pasa nada.
  }
}

export function loadSavedCustomer(): SavedCustomer {
  const raw = read(CUSTOMER_KEY);
  if (!raw) return EMPTY_CUSTOMER;
  try {
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== "object") return EMPTY_CUSTOMER;
    const out = { ...EMPTY_CUSTOMER };
    for (const key of Object.keys(EMPTY_CUSTOMER) as (keyof SavedCustomer)[]) {
      const value = (data as Record<string, unknown>)[key];
      if (typeof value === "string" && value.length <= 200) (out as Record<string, string>)[key] = value;
    }
    if (!["", "shipping", "pickup"].includes(out.delivery)) out.delivery = "";
    return out;
  } catch {
    return EMPTY_CUSTOMER;
  }
}

export function saveCustomer(data: SavedCustomer): void {
  write(CUSTOMER_KEY, JSON.stringify(data));
}

/** Borra los datos de compra recordados (al eliminar la cuenta). El carrito no se toca. */
export function forgetSavedCustomer(): void {
  try {
    window.localStorage.removeItem(CUSTOMER_KEY);
  } catch {
    // Sin almacenamiento: no hay nada que borrar.
  }
}

/** Solo links internos de pedido (nunca otra cosa). */
const ORDER_PATH = /^\/pedido\/[0-9a-f-]{36}\?t=[A-Za-z0-9_-]{43}$/;

export function saveLastOrder(path: string): void {
  if (ORDER_PATH.test(path)) write(LAST_ORDER_KEY, path);
}

export function loadLastOrder(): string | null {
  const path = read(LAST_ORDER_KEY);
  return path && ORDER_PATH.test(path) ? path : null;
}

/** true la PRIMERA vez que se pide para ese pedido (después, false). */
export function shouldClearCartFor(orderId: string): boolean {
  if (read(CLEARED_KEY) === orderId) return false;
  write(CLEARED_KEY, orderId);
  return true;
}
