"use client";

import { Boxes, Info, SlidersHorizontal } from "lucide-react";
import { SectionCard } from "@/components/admin/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAdjustStockDialog } from "../../stock/_components/adjust-stock-dialog";
import type { FormCardProps, FormVariant } from "../types";
import { Field, fieldProps } from "./field";
import { QuantityInput } from "./number-inputs";

/**
 * Inventario de un producto SIN variantes: su única variante.
 * (Con variantes, esto lo maneja la tabla de combinaciones, parte 5B.)
 */
export function InventoryCard({ values, update, errors, disabled, liveStock }: FormCardProps) {
  const variant = values.variants[0];
  const isExisting = variant.id !== null;
  const adjust = useAdjustStockDialog();
  // El stock real (se actualiza al ajustar) o, si no llegó, el de la carga
  const stock = (variant.id && liveStock[variant.id]) ?? variant.stock ?? 0;
  const err = (field: keyof FormVariant) => errors[`variants.0.${field}`];

  function change(patch: Partial<FormVariant>) {
    update({ variants: [{ ...variant, ...patch }] });
  }

  return (
    <SectionCard
      icon={Boxes}
      title="Inventario"
      description="Stock y código interno. El código de barras se genera solo al guardar."
      contentClassName="grid gap-5 sm:grid-cols-3"
    >
      {isExisting ? (
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Stock actual</span>
          <div className="flex h-8 items-center gap-3">
            <span className="text-lg font-semibold tabular-nums">{stock}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => values.id && adjust.openFor(values.id, values.name, variant.id ?? undefined)}
            >
              <SlidersHorizontal /> Ajustar stock
            </Button>
          </div>
          <p className="flex gap-1 text-xs text-muted-foreground">
            <Info className="mt-px size-3 shrink-0" aria-hidden />
            Ingresos, ventas, roturas o correcciones.
          </p>
          {adjust.dialog}
        </div>
      ) : (
        <Field
          id="variant-initial-stock"
          label="Stock inicial"
          error={err("initialStock")}
          help="Cuántas unidades tenés hoy."
        >
          <QuantityInput
            {...fieldProps("variant-initial-stock", err("initialStock"), true)}
            value={variant.initialStock}
            onValueChange={(initialStock) => change({ initialStock })}
            placeholder="0"
            disabled={disabled}
          />
        </Field>
      )}

      <Field
        id="variant-min-stock"
        label="Stock mínimo"
        error={err("minStock")}
        help="Avisamos cuando quede esto o menos."
      >
        <QuantityInput
          {...fieldProps("variant-min-stock", err("minStock"), true)}
          value={variant.minStock}
          onValueChange={(minStock) => change({ minStock })}
          placeholder="0"
          disabled={disabled}
        />
      </Field>

      <Field id="variant-sku" label="SKU" optional error={err("sku")} help="Código interno, si usan uno.">
        <Input
          {...fieldProps("variant-sku", err("sku"), true)}
          value={variant.sku}
          onChange={(e) => change({ sku: e.target.value.toUpperCase() })}
          maxLength={60}
          autoComplete="off"
          spellCheck={false}
          className="font-mono uppercase"
          disabled={disabled}
        />
      </Field>
    </SectionCard>
  );
}
