"use client";

import { useMemo, useSyncExternalStore } from "react";
import { normalizeSettings, type LabelSettings } from "@/lib/labels/layout";

/**
 * Configuración de la hoja (columnas, filas, posición inicial), recordada
 * en ESTE navegador (localStorage). Es una preferencia de cada impresora,
 * no un dato del negocio, por eso no va a la base.
 *
 * useSyncExternalStore: lee localStorage sin desajustes entre lo que arma
 * el servidor (que no tiene localStorage → valores por defecto) y el
 * navegador.
 */
const KEY = "home-deko:etiquetas:hoja";
const EVENT = "home-deko:etiquetas:hoja";
/** Copia en memoria, por si el navegador bloquea localStorage (igual funciona mientras dure la pestaña). */
let memory: string | null = null;

function read(): string | null {
  try {
    return localStorage.getItem(KEY) ?? memory;
  } catch {
    return memory; // navegación privada o almacenamiento bloqueado
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(EVENT, onChange);
  };
}

export function useLabelSettings(): [LabelSettings, (next: LabelSettings) => void] {
  const raw = useSyncExternalStore(subscribe, read, () => null);
  const settings = useMemo(() => {
    try {
      return normalizeSettings(raw ? JSON.parse(raw) : null);
    } catch {
      return normalizeSettings(null);
    }
  }, [raw]);

  function save(next: LabelSettings) {
    memory = JSON.stringify(normalizeSettings(next));
    try {
      localStorage.setItem(KEY, memory);
    } catch {
      // sin almacenamiento: queda solo en memoria
    }
    window.dispatchEvent(new Event(EVENT));
  }

  return [settings, save];
}
