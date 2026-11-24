"use client";

import { AlertTriangle, Layers, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/admin/section-card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { countCombinations, defaultVariant, newKey, syncVariants } from "../form-state";
import type { FormCardProps, FormOption } from "../types";
import { CombinationsTable } from "./combinations-table";
import { OptionEditor } from "./option-editor";

const MAX_OPTIONS = 3;
const MAX_COMBINATIONS = 100;
const SUGGESTED_OPTIONS = ["Color", "Medida", "Material"];

/**
 * Variantes: el interruptor "Este producto tiene variantes", las opciones
 * con sus valores y la tabla de combinaciones que se genera sola.
 */
export function VariantsCard(props: FormCardProps) {
  const { values, update, errors, disabled } = props;
  const { options } = values;

  // ----- Prender / apagar (sin perder lo cargado) ----------------------
  function toggle(on: boolean) {
    if (on) {
      const stash = values.stashedVariants;
      update({
        hasVariants: true,
        stashedSimple: values.variants[0] ?? null,
        options: stash?.options ?? [],
        variants: stash?.variants ?? [],
        excludedKeys: stash?.excludedKeys ?? [],
        stashedVariants: null,
      });
    } else {
      update({
        hasVariants: false,
        stashedVariants: { options, variants: values.variants, excludedKeys: values.excludedKeys },
        options: [],
        variants: [values.stashedSimple ?? defaultVariant()],
        excludedKeys: [],
        stashedSimple: null,
      });
    }
  }

  // ----- Opciones -------------------------------------------------------
  /** Cambia las opciones y rearma las combinaciones. */
  function setOptions(next: FormOption[]): string | null {
    const count = countCombinations(next);
    if (count > MAX_COMBINATIONS) {
      return `Serían ${count} combinaciones y el máximo es ${MAX_COMBINATIONS}.`;
    }
    update({ options: next, variants: syncVariants(next, values.variants, values.excludedKeys) });
    return null;
  }

  function addOption(name: string) {
    if (options.length >= MAX_OPTIONS) return;
    setOptions([...options, { key: newKey("opt"), id: null, name, values: [] }]);
    // Llevar el cursor al campo para escribir el primer valor (o el nombre)
    requestAnimationFrame(() => {
      const editors = document.querySelectorAll<HTMLElement>("[data-option-editor]");
      const last = editors[editors.length - 1];
      last?.querySelector<HTMLInputElement>(name ? "input[aria-label^='Agregar']" : "input")?.focus();
    });
  }

  const usedNames = new Set(options.map((o) => o.name.trim().toLowerCase()));
  const suggestions = SUGGESTED_OPTIONS.filter((n) => !usedNames.has(n.toLowerCase()));

  // ----- Aviso: combinaciones guardadas con stock que se quitarían -------
  const currentKeys = new Set(values.variants.map((v) => v.key));
  const stockOf = (v: { id: string | null; stock: number | null }) => (v.id ? (props.liveStock[v.id] ?? v.stock ?? 0) : 0);
  const lostWithStock = values.savedVariants.filter((v) => stockOf(v) > 0 && !currentKeys.has(v.key));

  return (
    <SectionCard
      icon={Layers}
      title="Variantes"
      description="Colores, medidas u otras características."
      contentClassName="flex flex-col gap-5"
    >
      <div className="flex items-start justify-between gap-4 rounded-lg border px-3 py-2.5">
        <div className="flex flex-col gap-0.5">
          <Label htmlFor="product-has-variants">Este producto tiene variantes</Label>
          <p className="text-xs text-muted-foreground">
            Ej.: una taza en 3 colores y 2 medidas = 6 variantes, cada una con su stock y su código.
          </p>
        </div>
        <Switch
          id="product-has-variants"
          checked={values.hasVariants}
          onCheckedChange={toggle}
          disabled={disabled}
        />
      </div>

      {lostWithStock.length > 0 && (
        <div role="alert" className="flex gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <div>
            <p className="font-medium">Así no se va a poder guardar</p>
            <p>
              Se quitarían variantes que todavía tienen stock:{" "}
              {lostWithStock.map((v) => `${v.savedLabel ?? "variante"} (${stockOf(v)})`).join(", ")}. Primero
              ajustá su stock a 0, o volvé a agregarlas.
            </p>
          </div>
        </div>
      )}

      {values.hasVariants && (
        <>
          {/* Opciones */}
          <div className="flex flex-col gap-3">
            {options.map((option, i) => (
              <div key={option.key} data-option-editor>
                <OptionEditor
                  option={option}
                  index={i}
                  errors={errors}
                  disabled={disabled}
                  onChange={(changed) => setOptions(options.map((o) => (o.key === option.key ? changed : o)))}
                  onRemove={() => {
                    const problem = setOptions(options.filter((o) => o.key !== option.key));
                    if (problem) toast.error(problem);
                  }}
                />
              </div>
            ))}

            {errors.options && <p className="text-xs text-destructive">{errors.options}</p>}

            {options.length < MAX_OPTIONS ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {options.length === 0 ? "Agregá una opción:" : "Otra opción:"}
                </span>
                {suggestions.map((name) => (
                  <Button key={name} type="button" variant="outline" size="sm" onClick={() => addOption(name)} disabled={disabled}>
                    <Plus /> {name}
                  </Button>
                ))}
                <Button type="button" variant="ghost" size="sm" onClick={() => addOption("")} disabled={disabled}>
                  <Plus /> Otra…
                </Button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Máximo {MAX_OPTIONS} opciones por producto.</p>
            )}
          </div>

          <Separator />

          {/* Combinaciones */}
          <div className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-sm font-semibold">
                Combinaciones{" "}
                {values.variants.length > 0 && (
                  <span className="font-normal text-muted-foreground tabular-nums">({values.variants.length})</span>
                )}
              </h3>
              <p className="text-xs text-muted-foreground">Precio vacío = usa el precio de venta.</p>
            </div>
            <CombinationsTable {...props} />
          </div>
        </>
      )}
    </SectionCard>
  );
}
