import { CART_MAX_ITEMS, CART_MAX_QTY, type CartItem } from "@/lib/cart";

/**
 * El carrito guardado en el navegador (localStorage), SOLO con
 * { variantId, qty }. Ver la regla en src/lib/cart.ts.
 *
 * Se lee con useSyncExternalStore (cart-provider.tsx): así todos los
 * componentes ven lo mismo, y si el cliente tiene la tienda abierta en dos
 * pestañas, agregar en una actualiza la otra (evento "storage").
 *
 * Todo va dentro de try/catch: en modo privado o con el almacenamiento
 * bloqueado, el carrito funciona igual mientras dure la visita.
 */

const STORAGE_KEY = "hd_carrito";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Mismo arreglo vacío siempre (useSyncExternalStore compara por referencia). */
const EMPTY: CartItem[] = [];

let current: CartItem[] | null = null;
const listeners = new Set<() => void>();

/** Lee y limpia lo guardado: lo que no tenga la forma esperada se descarta. */
function load(): CartItem[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return EMPTY;
    const items: CartItem[] = [];
    for (const x of data) {
      if (
        x &&
        typeof x === "object" &&
        typeof x.variantId === "string" &&
        UUID.test(x.variantId) &&
        Number.isInteger(x.qty) &&
        x.qty >= 1 &&
        !items.some((i) => i.variantId === x.variantId)
      ) {
        items.push({ variantId: x.variantId, qty: Math.min(x.qty, CART_MAX_QTY) });
      }
    }
    return items.slice(0, CART_MAX_ITEMS);
  } catch {
    return EMPTY;
  }
}

function emit() {
  listeners.forEach((l) => l());
}

function save(items: CartItem[]) {
  current = items.length ? items : EMPTY;
  try {
    if (items.length) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Sin almacenamiento: queda en memoria hasta cerrar la pestaña.
  }
  emit();
}

function onStorage(e: StorageEvent) {
  if (e.key !== STORAGE_KEY && e.key !== null) return;
  current = load();
  emit();
}

export function subscribeCart(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1) window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener("storage", onStorage);
  };
}

export function getCartSnapshot(): CartItem[] {
  if (current === null) current = load();
  return current;
}

/** En el servidor (y en el primer dibujo) el carrito está vacío. */
export function getCartServerSnapshot(): CartItem[] {
  return EMPTY;
}

/** Suma unidades de una variante (como máximo `max`, si se sabe el stock). */
export function addCartItem(variantId: string, qty: number, max: number = CART_MAX_QTY): void {
  const items = getCartSnapshot();
  const limit = Math.min(max, CART_MAX_QTY);
  const existing = items.find((i) => i.variantId === variantId);
  if (existing) {
    save(items.map((i) => (i.variantId === variantId ? { ...i, qty: Math.min(i.qty + qty, limit) } : i)));
  } else if (items.length < CART_MAX_ITEMS) {
    save([...items, { variantId, qty: Math.min(qty, limit) }]);
  }
}

/** Cambia la cantidad (0 o menos = la saca). */
export function setCartItemQty(variantId: string, qty: number): void {
  const items = getCartSnapshot();
  if (qty <= 0) return removeCartItem(variantId);
  save(items.map((i) => (i.variantId === variantId ? { ...i, qty: Math.min(qty, CART_MAX_QTY) } : i)));
}

export function removeCartItem(variantId: string): void {
  save(getCartSnapshot().filter((i) => i.variantId !== variantId));
}

/** Reemplaza todo (lo usa el panel del carrito al ajustar con los datos del servidor). */
export function replaceCart(items: CartItem[]): void {
  save(items);
}
