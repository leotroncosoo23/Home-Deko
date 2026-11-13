"use client";

import { useState } from "react";
import { Lock, RotateCcw, SlidersHorizontal, Trash2, Wand2 } from "lucide-react";
import { useAdjustStockDialog } from "../../stock/_components/adjust-stock-dialog";
import { toast } from "sonner";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { allCombinations, combinationKey, suggestSku, syncVariants, variantColor, variantLabel } from "../form-state";
import type { FormCardProps, FormVariant } from "../types";
import { MoneyInput, QuantityInput } from "./number-inputs";

/**
 * Tabla de combinaciones (se arma sola con las opciones). Por cada una:
 * stock inicial (o el actual, si ya existe), stock mínimo, precio
 * opcional, costo opcional y SKU. Se pueden quitar las que no existen.
 *
 * En PC es una tabla; en el celular, una tarjeta por combinación.
 */
export function CombinationsTable({ values, update, errors, disabled, liveStock }: FormCardProps) {
  const { variants, options } = values;
  const adjust = useAdjustStockDialog();
  // Stock real de una variante guardada (se actualiza al ajustar)
  const stockOf = (v: FormVariant) => (v.id ? (liveStock[v.id] ?? v.stock ?? 0) : 0);
  const [showCosts, setShowCosts] = useState(() => variants.some((v) => v.costPrice !== ""));

  function changeVariant(index: number, patch: Partial<FormVariant>) {
    update({ variants: variants.map((v, i) => (i === index ? { ...v, ...patch } : v)) });
  }

  function removeVariant(variant: FormVariant) {
    update({
      excludedKeys: [...values.excludedKeys, variant.key],
      variants: variants.filter((v) => v.key !== variant.key),
    });
  }

  // Combinaciones quitadas que todavía existen con las opciones actuales
  const possible = new Set(allCombinations(options).map(combinationKey));
  const removed = values.excludedKeys.filter((k) => possible.has(k));

  function restore(key: string) {
    const excludedKeys = values.excludedKeys.filter((k) => k !== key);
    update({ excludedKeys, variants: syncVariants(options, variants, excludedKeys) });
  }

  function generateSkus() {
    if (!values.name.trim()) {
      toast.error("Primero escribí el nombre del producto.");
      return;
    }
    let filled = 0;
    update({
      variants: variants.map((v) => {
        if (v.sku.trim()) return v;
        filled++;
        return { ...v, sku: suggestSku(values.name, variantLabel(v.valueKeys, options).split(" / ")) };
      }),
    });
    toast.success(filled ? `Se completaron ${filled} SKU` : "Todas las combinaciones ya tenían SKU.");
  }

  if (variants.length === 0) {
    return (
      <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
        Agregá valores a las opciones y las combinaciones aparecen acá solas.
      </p>
    );
  }

  const hasNew = variants.some((v) => v.id === null);
  const basePricePlaceholder = values.basePrice || "Precio base";

  return (
    <div className="flex flex-col gap-3">
      <BulkFill values={values} update={update} disabled={disabled} hasNew={hasNew} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Switch size="sm" checked={showCosts} onCheckedChange={setShowCosts} />
          Costo por combinación
          <Lock className="size-3" aria-hidden />
        </label>
        <Button type="button" variant="outline" size="sm" onClick={generateSkus} disabled={disabled}>
          <Wand2 /> Generar SKUs
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border">
        {/* Encabezados (desde tablet) */}
        <div
          className={cn(
            "hidden items-center gap-2 border-b bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground md:grid",
            showCosts ? GRID_WITH_COST : GRID,
          )}
        >
          <span>Combinación</span>
          <span className="text-right">{hasNew ? "Stock inicial" : "Stock"}</span>
          <span className="text-right">Stock mín.</span>
          <span className="text-right">Precio</span>
          {showCosts && <span className="text-right">Costo</span>}
          <span>SKU</span>
          <span />
        </div>

        <ul className="divide-y">
          {variants.map((v, i) => {
            const label = variantLabel(v.valueKeys, options);
            const color = variantColor(v.valueKeys, options);
            const err = (field: string) => errors[`variants.${i}.${field}`];
            const hasStock = v.id !== null && stockOf(v) > 0;
            return (
              <li
                key={v.key}
                className={cn("grid grid-cols-2 gap-2 px-3 py-3 md:items-center md:py-2", showCosts ? ROW_GRID_WITH_COST : ROW_GRID)}
              >
                {/* Combinación */}
                <div className="col-span-2 flex min-w-0 items-center gap-2 md:col-span-1">
                  {color && (
                    <span className="size-3.5 shrink-0 rounded-full border border-black/15" style={{ backgroundColor: color }} aria-hidden />
                  )}
                  <span className="truncate text-sm font-medium">{label}</span>
                  {v.id === null && values.savedVariants.length > 0 && (
                    <span className="shrink-0 rounded bg-brand-soft px-1.5 text-[11px] font-medium text-brand">Nueva</span>
                  )}
                </div>

                {/* Stock inicial (nueva) o stock actual (existente) */}
                <Cell label={v.id ? "Stock" : "Stock inicial"} error={err("initialStock")}>
                  {v.id ? (
                    <button
                      type="button"
                      onClick={() => values.id && adjust.openFor(values.id, values.name, v.id ?? undefined)}
                      disabled={disabled}
                      title="Ajustar el stock"
                      aria-label={`Stock de ${label}: ${stockOf(v)}. Ajustar`}
                      className="flex h-8 w-full items-center justify-end gap-1.5 rounded-md px-2 text-sm font-medium tabular-nums outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/40"
                    >
                      {stockOf(v)}
                      <SlidersHorizontal className="size-3.5 text-muted-foreground" aria-hidden />
                    </button>
                  ) : (
                    <QuantityInput
                      value={v.initialStock}
                      onValueChange={(initialStock) => changeVariant(i, { initialStock })}
                      placeholder="0"
                      disabled={disabled}
                      aria-label={`Stock inicial de ${label}`}
                      aria-invalid={Boolean(err("initialStock")) || undefined}
                    />
                  )}
                </Cell>

                <Cell label="Stock mínimo" error={err("minStock")}>
                  <QuantityInput
                    value={v.minStock}
                    onValueChange={(minStock) => changeVariant(i, { minStock })}
                    placeholder="0"
                    disabled={disabled}
                    aria-label={`Stock mínimo de ${label}`}
                    aria-invalid={Boolean(err("minStock")) || undefined}
                  />
                </Cell>

                <Cell label="Precio" error={err("price")}>
                  <MoneyInput
                    value={v.price}
                    onValueChange={(price) => changeVariant(i, { price })}
                    placeholder={basePricePlaceholder}
                    disabled={disabled}
                    aria-label={`Precio de ${label} (vacío = precio base)`}
                    aria-invalid={Boolean(err("price")) || undefined}
                  />
                </Cell>

                {showCosts && (
                  <Cell label="Costo" error={err("costPrice")}>
                    <MoneyInput
                      value={v.costPrice}
                      onValueChange={(costPrice) => changeVariant(i, { costPrice })}
                      placeholder={values.costPrice || "Costo general"}
                      disabled={disabled}
                      aria-label={`Costo de ${label} (vacío = costo general)`}
                      aria-invalid={Boolean(err("costPrice")) || undefined}
                    />
                  </Cell>
                )}

                {/* En el celular: con costo, el SKU ocupa toda la fila */}
                <Cell label="SKU" error={err("sku")} className={showCosts ? "col-span-2 md:col-span-1" : ""}>
                  <Input
                    value={v.sku}
                    onChange={(e) => changeVariant(i, { sku: e.target.value.toUpperCase() })}
                    maxLength={60}
                    autoComplete="off"
                    spellCheck={false}
                    disabled={disabled}
                    aria-label={`SKU de ${label}`}
                    aria-invalid={Boolean(err("sku")) || undefined}
                    className="font-mono text-xs uppercase"
                  />
                </Cell>

                {/* Quitar */}
                <div className="col-span-2 flex justify-end md:col-span-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => removeVariant(v)}
                    disabled={disabled || hasStock}
                    title={hasStock ? `Tiene ${v.stock} en stock: primero ajustá el stock a 0.` : "Esta combinación no existe"}
                    aria-label={`Quitar la combinación ${label}`}
                    className="text-muted-foreground"
                  >
                    <Trash2 />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {adjust.dialog}

      {removed.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>Quitaste:</span>
          {removed.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => restore(key)}
              disabled={disabled}
              className="flex items-center gap-1 rounded-full border px-2 py-0.5 hover:bg-muted hover:text-foreground"
              title="Volver a agregar"
            >
              <RotateCcw className="size-3" aria-hidden />
              {labelFromKey(key, options)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Columnas de la tabla en PC (con y sin la de costo). Escritas completas a
 * propósito: Tailwind busca las clases como texto en el código, así que no
 * se pueden armar con variables (`md:${x}` no funcionaría).
 */
const GRID = "grid-cols-[minmax(0,1fr)_5.5rem_5.5rem_8rem_9rem_2rem]";
const GRID_WITH_COST = "grid-cols-[minmax(0,1fr)_5.5rem_5.5rem_8rem_8rem_9rem_2rem]";
const ROW_GRID = "md:grid-cols-[minmax(0,1fr)_5.5rem_5.5rem_8rem_9rem_2rem]";
const ROW_GRID_WITH_COST = "md:grid-cols-[minmax(0,1fr)_5.5rem_5.5rem_8rem_8rem_9rem_2rem]";

/** Etiqueta "Rojo / 300 ml" de una clave, en el orden de las opciones. */
function labelFromKey(key: string, options: FormCardProps["values"]["options"]) {
  const keys = new Set(key.split("|"));
  return options
    .map((o) => o.values.find((v) => keys.has(v.key))?.value)
    .filter(Boolean)
    .join(" / ");
}

/** Celda: en el celular muestra su etiqueta arriba; en PC, solo el campo. */
function Cell({
  label,
  error,
  className,
  children,
}: {
  label: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <span className="text-xs text-muted-foreground md:hidden">{label}</span>
      {children}
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}

/** "Completar todas": el mismo stock, mínimo o precio en todas las filas. */
function BulkFill({
  values,
  update,
  disabled,
  hasNew,
}: Pick<FormCardProps, "values" | "update" | "disabled"> & { hasNew: boolean }) {
  const [initialStock, setInitialStock] = useState("");
  const [minStock, setMinStock] = useState("");
  const [price, setPrice] = useState("");
  const empty = !initialStock && !minStock && !price;

  function apply() {
    update({
      variants: values.variants.map((v) => ({
        ...v,
        // El stock inicial solo en las nuevas (las existentes usan "Ajustar stock")
        initialStock: initialStock && v.id === null ? initialStock : v.initialStock,
        minStock: minStock || v.minStock,
        price: price || v.price,
      })),
    });
    setInitialStock("");
    setMinStock("");
    setPrice("");
    toast.success("Listo: se completaron todas las combinaciones.");
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg bg-muted/50 p-3">
      <span className="text-xs font-medium text-muted-foreground">Completar todas las combinaciones</span>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-[repeat(3,minmax(0,8rem))_auto] sm:items-end">
        {hasNew && (
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Stock inicial
            <QuantityInput value={initialStock} onValueChange={setInitialStock} placeholder="—" disabled={disabled} className="bg-background" />
          </label>
        )}
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Stock mínimo
          <QuantityInput value={minStock} onValueChange={setMinStock} placeholder="—" disabled={disabled} className="bg-background" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Precio
          <MoneyInput value={price} onValueChange={setPrice} placeholder="—" disabled={disabled} className="bg-background" />
        </label>
        <Button type="button" variant="outline" onClick={apply} disabled={disabled || empty} className="bg-background">
          Aplicar a todas
        </Button>
      </div>
    </div>
  );
}
