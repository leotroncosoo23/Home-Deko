"use client";

import { useSyncExternalStore } from "react";

/**
 * Recordar la última URL del listado (con sus filtros) en esta pestaña,
 * para que "← Productos" y "Cancelar" vuelvan al listado como estaba.
 * El enlace "Productos" de la barra lateral, en cambio, abre el listado limpio.
 *
 * sessionStorage: dura mientras la pestaña esté abierta. Puede no estar
 * disponible (modo privado, permisos), por eso todo va con try/catch y,
 * si falla, se vuelve al listado sin filtros.
 */
const KEY = "homedeko:productos:listado";
const LIST_PATH = "/admin/productos";

export function rememberListUrl(url: string) {
  try {
    sessionStorage.setItem(KEY, url);
  } catch {
    // sin almacenamiento: no pasa nada, se vuelve al listado limpio
  }
}

function readListUrl(): string {
  try {
    const url = sessionStorage.getItem(KEY);
    // Solo una dirección del listado (nunca otra página ni otro sitio)
    return url && (url === LIST_PATH || url.startsWith(`${LIST_PATH}?`)) ? url : LIST_PATH;
  } catch {
    return LIST_PATH;
  }
}

const noSubscribe = () => () => {};

/** La URL del listado para volver. En el servidor (y al primer render) es la limpia. */
export function useProductsListUrl(): string {
  return useSyncExternalStore(noSubscribe, readListUrl, () => LIST_PATH);
}
