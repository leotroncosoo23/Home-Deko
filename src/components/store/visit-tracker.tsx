"use client";

import { useEffect } from "react";

/**
 * Contador ANÓNIMO de visitas de la tienda (sin cookies, sin datos personales).
 *
 * - VisitTracker (en el layout de la tienda): cuenta UNA visita por sesión del
 *   navegador. Para no contarla dos veces se guarda una marca en
 *   sessionStorage: no es una cookie, no viaja a ningún lado, no identifica a
 *   nadie y se borra al cerrar la pestaña.
 * - ProductViewTracker (en la página de producto): una vista por producto y
 *   por sesión.
 *
 * Qué se manda: el DOMINIO de la página anterior (nunca la URL completa) y el
 * utm_source del link. Nada más.
 *
 * Velocidad: corre después de que la página ya se mostró, cuando el navegador
 * está libre (requestIdleCallback), y usa sendBeacon, que no espera respuesta.
 * No toca el tiempo de carga.
 *
 * El servidor (/api/visita) descarta bots y admins.
 */

const ENDPOINT = "/api/visita";

/** Respaldo en memoria si sessionStorage no está disponible (modo privado, bloqueado). */
const seen = new Set<string>();

/** true la primera vez que se ve esta clave en la sesión. */
function firstTime(key: string): boolean {
  if (seen.has(key)) return false;
  seen.add(key);
  try {
    if (window.sessionStorage.getItem(key)) return false;
    window.sessionStorage.setItem(key, "1");
  } catch {
    // Sin sessionStorage: alcanza con la memoria (cuenta una vez por carga).
  }
  return true;
}

function send(payload: Record<string, string>) {
  const body = JSON.stringify(payload);
  try {
    // text/plain: un pedido "simple", sin consultas previas del navegador
    if (navigator.sendBeacon?.(ENDPOINT, new Blob([body], { type: "text/plain" }))) return;
  } catch {
    // sigue con fetch
  }
  fetch(ENDPOINT, { method: "POST", body, keepalive: true, headers: { "content-type": "text/plain" } }).catch(
    () => {},
  );
}

function whenIdle(fn: () => void) {
  if (typeof window.requestIdleCallback === "function") window.requestIdleCallback(fn, { timeout: 4000 });
  else window.setTimeout(fn, 1500);
}

/** Navegadores automatizados (pruebas, robots que ejecutan JavaScript): no se cuentan. */
function isAutomated(): boolean {
  return navigator.webdriver === true;
}

/** Solo el dominio de la página anterior; vacío si es la misma tienda o no hay. */
function referrerHost(): string {
  try {
    if (!document.referrer) return "";
    const host = new URL(document.referrer).hostname;
    return host === window.location.hostname ? "" : host.slice(0, 255);
  } catch {
    return "";
  }
}

export function VisitTracker() {
  useEffect(() => {
    if (isAutomated() || !firstTime("hd_visita")) return;
    const ref = referrerHost();
    const utm = new URLSearchParams(window.location.search).get("utm_source")?.slice(0, 60) ?? "";
    whenIdle(() => send({ k: "v", ref, utm }));
  }, []);
  return null;
}

export function ProductViewTracker({ productId }: { productId: string }) {
  useEffect(() => {
    if (isAutomated() || !firstTime(`hd_vista_${productId}`)) return;
    whenIdle(() => send({ k: "p", pid: productId }));
  }, [productId]);
  return null;
}
