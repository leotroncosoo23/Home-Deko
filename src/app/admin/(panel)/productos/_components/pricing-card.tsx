"use client";

import { Banknote, Lock } from "lucide-react";
import { SectionCard } from "@/components/admin/section-card";
import { formatARS, formatMoneyInput, parseMoney } from "@/lib/format";
import { listPrice } from "@/lib/pricing";
import type { FormCardProps } from "../types";
import { Field, fieldProps } from "./field";
import { MoneyInput } from "./number-inputs";

/** 15 → "15", 10.5 → "10,5". */
const formatPercent = (n: number) => formatMoneyInput(n);

/**
 * Precio en 1 pago (contado) y precio de costo (+ cuánto se gana).
 * El precio cargado es el EN 1 PAGO (contado); debajo se ve en vivo el precio
 * de lista (cuotas) con el "% recargo para precio de lista" de Configuración.
 */
export function PricingCard({
  values,
  update,
  errors,
  disabled,
  listSurchargePercent = 0,
}: FormCardProps & { listSurchargePercent?: number }) {
  const price = parseMoney(values.basePrice);
  const validPrice = price !== null && !Number.isNaN(price) && price > 0;
  const listHelp =
    listSurchargePercent > 0
      ? validPrice
        ? `Precio de lista (cuotas): ${formatARS(listPrice(price, listSurchargePercent))} (${formatPercent(listSurchargePercent)} % más).`
        : `El precio de lista (cuotas) es ${formatPercent(listSurchargePercent)} % más (Configuración → Precios).`
      : null;
  const variantsHelp = values.hasVariants ? "Cada combinación puede tener su propio precio." : null;
  const cost = parseMoney(values.costPrice);
  const showMargin = price !== null && cost !== null && price > 0 && !Number.isNaN(price) && !Number.isNaN(cost);
  const profit = showMargin ? price - cost : 0;
  // Recargo sobre el costo (ej.: costo 1.000, precio 1.500 → 50 %)
  const markup = showMargin && cost > 0 ? Math.round((profit / cost) * 100) : null;

  return (
    <SectionCard
      icon={Banknote}
      title="Precio"
      description="Precio en 1 pago (el que se cobra hoy) y costo de cada unidad."
      contentClassName="flex flex-col gap-4"
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          id="product-price"
          label="Precio en 1 pago (contado)"
          error={errors.basePrice}
          help={
            listHelp || variantsHelp ? (
              <span className="flex flex-col gap-0.5">
                {listHelp && <span className="tabular-nums">{listHelp}</span>}
                {variantsHelp && <span>{variantsHelp}</span>}
              </span>
            ) : undefined
          }
        >
          <MoneyInput
            {...fieldProps("product-price", errors.basePrice, values.hasVariants)}
            value={values.basePrice}
            onValueChange={(basePrice) => update({ basePrice })}
            placeholder="0"
            disabled={disabled}
          />
        </Field>

        <Field
          id="product-cost"
          label="Precio de costo"
          optional
          error={errors.costPrice}
          help={
            <span className="flex items-center gap-1">
              <Lock className="size-3" aria-hidden /> Solo lo ven los administradores.
            </span>
          }
        >
          <MoneyInput
            {...fieldProps("product-cost", errors.costPrice, true)}
            value={values.costPrice}
            onValueChange={(costPrice) => update({ costPrice })}
            placeholder="0"
            disabled={disabled}
          />
        </Field>
      </div>

      {showMargin && (
        <p className="rounded-lg bg-muted/60 px-3 py-2 text-sm text-muted-foreground">
          Ganancia por unidad:{" "}
          <span className={profit < 0 ? "font-medium text-destructive" : "font-medium text-foreground"}>
            <span className="tabular-nums">{formatARS(profit)}</span>
            {markup !== null && <span className="tabular-nums"> ({markup} % sobre el costo)</span>}
          </span>
        </p>
      )}
    </SectionCard>
  );
}
