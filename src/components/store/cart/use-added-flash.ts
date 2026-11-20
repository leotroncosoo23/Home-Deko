"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Cuánto dura "Agregado ✓" en el botón antes de volver a su texto. */
const ADDED_MS = 1600;

/**
 * Estado "Agregado ✓" de un botón: flash() lo prende y se apaga solo.
 * Si se toca otra vez, el tiempo vuelve a empezar.
 */
export function useAddedFlash(): [boolean, () => void] {
  const [added, setAdded] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const flash = useCallback(() => {
    setAdded(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setAdded(false), ADDED_MS);
  }, []);

  return [added, flash];
}
