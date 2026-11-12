"use client";

import { cn } from "cn";
import { formatMoneyInput, parseMoney } from "@/lib/format";

const inputBase =
  "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent text-sm tabular-nums outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20";

type BaseProps = Omit<React.ComponentProps<"input">, "value" | "onChange" | "type"> & {
  value: string;
  onValueChange: (value: string) => void;
};

/**
 * Campo de plata: muestra "$" adelante y, al salir del campo, lo deja
 * prolijo en formato argentino ("12500" → "12.500"; "1234,5" → "1.234,50").
 */
export function MoneyInput({ value, onValueChange, className, onBlur, ...props }: BaseProps) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-sm text-muted-foreground">
        $
      </span>
      <input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={value}
        onChange={(e) => onValueChange(e.target.value.replace(/[^\d.,]/g, ""))}
        onBlur={(e) => {
          const n = parseMoney(value);
          // Si es válido, lo reescribe prolijo; si no, lo deja (zod lo marca).
          if (n !== null && !Number.isNaN(n)) onValueChange(formatMoneyInput(n));
          onBlur?.(e);
        }}
        className={cn(inputBase, "pr-2.5 pl-6 text-right", className)}
        {...props}
      />
    </div>
  );
}

/** Campo de cantidad entera (stock): solo deja escribir dígitos. */
export function QuantityInput({ value, onValueChange, className, ...props }: BaseProps) {
  return (
    <input
      type="text"
      inputMode="numeric"
      autoComplete="off"
      value={value}
      onChange={(e) => onValueChange(e.target.value.replace(/\D/g, "").slice(0, 7))}
      className={cn(inputBase, "px-2.5 text-right", className)}
      {...props}
    />
  );
}
