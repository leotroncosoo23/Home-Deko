"use client";

import { useId } from "react";
import { Percent, Plus, X } from "lucide-react";
import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatARS, parseMoney } from "@/lib/format";
import { isoToArgentinaDay } from "../form-state";
import type { FormCardProps, FormDiscount } from "../types";
import { Field, fieldProps } from "./field";
import { MoneyInput } from "./number-inputs";

/**
 * Descuento opcional: porcentaje o monto fijo, con fechas opcionales.
 * Solo aparece si lo agregan (botón "Agregar descuento").
 */
export function DiscountCard({ values, update, errors, disabled }: FormCardProps) {
  const ids = useId();
  const discount = values.discount;

  if (!discount) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Descuento</CardTitle>
          <CardDescription>Opcional. Por porcentaje o monto fijo, y si querés, con fechas.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            onClick={() => {
              update({ discount: { type: "percent", value: "", startsOn: "", endsOn: "" } });
              requestAnimationFrame(() => document.getElementById(`${ids}-value`)?.focus());
            }}
          >
            <Plus /> Agregar descuento
          </Button>
        </CardContent>
      </Card>
    );
  }

  const change = (patch: Partial<FormDiscount>) => update({ discount: { ...discount, ...patch } });

  // Vista previa sobre el precio de venta
  const price = parseMoney(values.basePrice);
  const amount = parseMoney(discount.value);
  const canPreview = price !== null && price > 0 && amount !== null && amount > 0 && !Number.isNaN(price) && !Number.isNaN(amount);
  const final = canPreview
    ? Math.max(0, discount.type === "percent" ? price * (1 - amount / 100) : price - amount)
    : null;

  const status = discountStatus(discount);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Descuento
          <Badge className={status.className}>{status.label}</Badge>
        </CardTitle>
        <CardDescription>
          {status.help}
          {values.hasVariants && " Se aplica a todas las combinaciones, sobre el precio de cada una."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="grid gap-5 sm:grid-cols-2">
          {/* Tipo */}
          <div className="flex flex-col gap-1.5">
            <Label id={`${ids}-type`}>Tipo</Label>
            <div role="radiogroup" aria-labelledby={`${ids}-type`} className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
              {(
                [
                  ["percent", "Porcentaje"],
                  ["fixed", "Monto fijo"],
                ] as const
              ).map(([type, label]) => (
                <button
                  key={type}
                  type="button"
                  role="radio"
                  aria-checked={discount.type === type}
                  disabled={disabled}
                  onClick={() => change({ type, value: "" })}
                  className={cn(
                    "h-7 rounded-md text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                    discount.type === type ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Valor */}
          <Field
            id={`${ids}-value`}
            label={discount.type === "percent" ? "Porcentaje" : "Monto a descontar"}
            error={errors["discount.value"]}
          >
            {discount.type === "percent" ? (
              <div className="relative">
                <Input
                  {...fieldProps(`${ids}-value`, errors["discount.value"])}
                  value={discount.value}
                  onChange={(e) => change({ value: e.target.value.replace(/[^\d,]/g, "") })}
                  inputMode="decimal"
                  placeholder="15"
                  maxLength={5}
                  autoComplete="off"
                  disabled={disabled}
                  className="pr-8 text-right tabular-nums"
                />
                <Percent className="pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
              </div>
            ) : (
              <MoneyInput
                {...fieldProps(`${ids}-value`, errors["discount.value"])}
                value={discount.value}
                onValueChange={(value) => change({ value })}
                placeholder="1.000"
                disabled={disabled}
              />
            )}
          </Field>

          {/* Fechas */}
          <Field id={`${ids}-from`} label="Desde" optional help="Vacío = desde ahora.">
            <Input
              {...fieldProps(`${ids}-from`, undefined, true)}
              type="date"
              value={discount.startsOn}
              onChange={(e) => change({ startsOn: e.target.value })}
              disabled={disabled}
            />
          </Field>
          <Field id={`${ids}-to`} label="Hasta" optional error={errors["discount.endsAt"]} help="Vacío = sin fecha de fin. Incluye ese día completo.">
            <Input
              {...fieldProps(`${ids}-to`, errors["discount.endsAt"], true)}
              type="date"
              value={discount.endsOn}
              min={discount.startsOn || undefined}
              onChange={(e) => change({ endsOn: e.target.value })}
              disabled={disabled}
            />
          </Field>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          {final !== null && price !== null ? (
            <p className="text-sm">
              <span className="text-muted-foreground line-through tabular-nums">{formatARS(price)}</span>
              <span className="mx-1.5 text-muted-foreground">→</span>
              <span className="font-semibold tabular-nums">{formatARS(final)}</span>
              <span className="ml-1.5 text-xs text-muted-foreground tabular-nums">(ahorran {formatARS(price - final)})</span>
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">Cargá el precio de venta y el valor para ver el precio final.</p>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => update({ discount: null })}
            disabled={disabled}
            className="text-muted-foreground"
          >
            <X /> Quitar descuento
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/** "Activo", "Programado" o "Terminado", según las fechas (hora de Argentina). */
function discountStatus(d: FormDiscount) {
  const today = isoToArgentinaDay(new Date().toISOString());
  const format = (day: string) => day.split("-").reverse().slice(0, 2).join("/"); // "2026-12-01" → "01/12"
  if (d.endsOn && d.endsOn < today) {
    return { label: "Terminado", className: "bg-neutral-100 text-muted-foreground", help: `Terminó el ${format(d.endsOn)}.` };
  }
  if (d.startsOn && d.startsOn > today) {
    return { label: "Programado", className: "bg-amber-50 text-amber-700", help: `Empieza el ${format(d.startsOn)}.` };
  }
  return {
    label: "Activo",
    className: "bg-emerald-50 text-emerald-700",
    help: d.endsOn ? `Vale hasta el ${format(d.endsOn)} inclusive.` : "Vale hasta que lo quites.",
  };
}
