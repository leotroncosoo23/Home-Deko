"use client";

import { Minus, Plus } from "lucide-react";
import { cn } from "cn";
import { MAX_PER_VARIANT } from "../types";

/**
 * Cantidad de etiquetas: [−] [ 12 ] [+]
 * Botones grandes para el dedo en el celular. Solo deja escribir dígitos;
 * el valor es texto ("" mientras se borra para escribir otro número).
 */
export function QuantityStepper({
  value,
  onChange,
  label,
  disabled,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  /** Para lectores de pantalla: "Cantidad de etiquetas de Taza Rojo". */
  label: string;
  disabled?: boolean;
  className?: string;
}) {
  const n = Number(value) || 0;
  const step = (delta: number) => onChange(String(Math.min(MAX_PER_VARIANT, Math.max(1, n + delta))));
  const button =
    "flex size-8 shrink-0 items-center justify-center text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:bg-muted disabled:pointer-events-none disabled:opacity-40";

  return (
    <div
      className={cn(
        "flex h-8 items-center overflow-hidden rounded-lg border border-input bg-background focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/20",
        disabled && "opacity-50",
        className,
      )}
    >
      <button type="button" className={button} onClick={() => step(-1)} disabled={disabled || n <= 1} aria-label="Una menos">
        <Minus className="size-3.5" aria-hidden />
      </button>
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        aria-label={label}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 3))}
        onBlur={() => {
          // Al salir del campo: nunca queda vacío ni en 0
          if (n < 1) onChange("1");
        }}
        onFocus={(e) => e.target.select()}
        className="h-full w-10 min-w-0 bg-transparent text-center text-sm font-medium tabular-nums outline-none"
      />
      <button
        type="button"
        className={button}
        onClick={() => step(1)}
        disabled={disabled || n >= MAX_PER_VARIANT}
        aria-label="Una más"
      >
        <Plus className="size-3.5" aria-hidden />
      </button>
    </div>
  );
}
