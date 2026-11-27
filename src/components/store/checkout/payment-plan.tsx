"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/format";
import { installmentValue, type InstallmentCount, type PaymentPlan } from "@/lib/pricing";
import { ErrorText } from "../form-field";

/**
 * "Forma de pago" del resumen del checkout:
 *
 *   (●) 1 pago                  $ 54.000   ← precio contado (por defecto)
 *   ( ) Cuotas sin interés      $ 71.920   ← precio de lista
 *         ( ) 3 cuotas de $ 23.973,33
 *         (●) 6 cuotas de $ 11.986,67
 *
 * Solo se muestra con las cuotas prendidas en Configuración (si no, todo es
 * 1 pago). Con un cupón aplicado, las cuotas quedan deshabilitadas: los
 * cupones son solo para 1 pago. Los montos son INFORMATIVOS: el total que
 * vale lo calcula create_order con la misma regla.
 */
export function PaymentPlanPicker({
  choices,
  plan,
  installments,
  onChange,
  singleTotal,
  installmentsTotal,
  couponCode,
  error,
}: {
  /** 3/6/9/12 hasta el máximo de Configuración (installmentChoices). */
  choices: InstallmentCount[];
  plan: PaymentPlan;
  installments: InstallmentCount;
  onChange: (plan: PaymentPlan, installments: InstallmentCount) => void;
  /** Total en 1 pago (con cupón y envío). */
  singleTotal: number;
  /** Total en cuotas: lista de los productos + envío. */
  installmentsTotal: number;
  /** Cupón aplicado: las cuotas no se pueden elegir. */
  couponCode: string | null;
  error?: string;
}) {
  const ids = useId();
  const blocked = couponCode !== null;
  const onInstallments = plan === "installments" && !blocked;

  return (
    // La línea de arriba va en un div: en un <fieldset> con borde, el <legend> queda cortado por la línea.
    <div className="border-t pt-4">
      <fieldset
        id="co-installments"
        tabIndex={-1}
        aria-describedby={error ? `${ids}-error` : undefined}
        className="flex flex-col gap-2.5 outline-none"
      >
        <legend className="mb-2.5 font-semibold">Forma de pago</legend>

        <PlanOption
          name={`${ids}-plan`}
          checked={!onInstallments}
          onSelect={() => onChange("single", installments)}
          title="1 pago"
          amount={singleTotal}
        />

        <PlanOption
          name={`${ids}-plan`}
          checked={onInstallments}
          disabled={blocked}
          onSelect={() => onChange("installments", installments)}
          title="Cuotas sin interés"
          amount={installmentsTotal}
          note={blocked ? `El cupón ${couponCode} es solo para pagar en 1 pago. Quitalo para pagar en cuotas.` : null}
        >
          {onInstallments && (
            <div role="radiogroup" aria-label="Cantidad de cuotas" className="mt-1 flex flex-col gap-1.5">
              {choices.map((n) => {
                const selected = installments === n;
                return (
                  <label
                    key={n}
                    className={cn(
                      "flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-sm transition-colors has-focus-visible:ring-3 has-focus-visible:ring-ring/20",
                      selected ? "border-brand bg-background" : "bg-background/60 hover:bg-background",
                    )}
                  >
                    <input
                      type="radio"
                      name={`${ids}-n`}
                      checked={selected}
                      onChange={() => onChange("installments", n)}
                      className="sr-only"
                    />
                    <Dot checked={selected} small />
                    <span className="tabular-nums">
                      <span className="font-semibold">{n} cuotas</span> de{" "}
                      <span className="whitespace-nowrap">{formatPrice(installmentValue(installmentsTotal, n))}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </PlanOption>

        {error && <ErrorText id={`${ids}-error`}>{error}</ErrorText>}
      </fieldset>
    </div>
  );
}

function PlanOption({
  name,
  checked,
  disabled = false,
  onSelect,
  title,
  amount,
  note,
  children,
}: {
  name: string;
  checked: boolean;
  disabled?: boolean;
  onSelect: () => void;
  title: string;
  amount: number;
  note?: string | null;
  children?: React.ReactNode;
}) {
  const id = useId();
  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-xl border p-3.5 transition-colors",
        checked ? "border-brand bg-brand-soft/50" : !disabled && "hover:bg-muted/50",
        disabled && "opacity-60",
      )}
    >
      <label
        htmlFor={id}
        className={cn(
          "flex items-center gap-3 rounded-md has-focus-visible:ring-3 has-focus-visible:ring-ring/20",
          disabled ? "cursor-not-allowed" : "cursor-pointer",
        )}
      >
        <input
          id={id}
          type="radio"
          name={name}
          checked={checked}
          disabled={disabled}
          onChange={onSelect}
          className="sr-only"
        />
        <Dot checked={checked} />
        <span className="flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-x-3">
          <span className="font-semibold">{title}</span>
          <span className="font-semibold whitespace-nowrap tabular-nums">{formatPrice(amount)}</span>
        </span>
      </label>
      {note && <p className="text-xs leading-snug text-muted-foreground">{note}</p>}
      {children}
    </div>
  );
}

function Dot({ checked, small = false }: { checked: boolean; small?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full border-2",
        small ? "size-4" : "size-5",
        checked ? "border-brand" : "border-input",
      )}
    >
      {checked && <span className={cn("rounded-full bg-brand", small ? "size-2" : "size-2.5")} />}
    </span>
  );
}
