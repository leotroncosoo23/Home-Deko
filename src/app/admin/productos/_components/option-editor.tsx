"use client";

import { useId, useState } from "react";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { arrayMove, rectSortingStrategy, SortableContext, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { Palette, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isColorOption, suggestColorHex } from "@/lib/colors";
import { newKey } from "../form-state";
import type { FormErrors, FormOption, FormOptionValue } from "../types";
import { ValueChip } from "./value-chip";

/**
 * Una opción ("Color", "Medida"…) con sus valores en chips.
 * Los valores se agregan con Enter. No usamos la coma como separador
 * porque hay valores que la llevan: "1,5 L".
 */
export function OptionEditor({
  option,
  index,
  errors,
  disabled,
  onChange,
  onRemove,
}: {
  option: FormOption;
  index: number;
  errors: FormErrors;
  disabled: boolean;
  /** Devuelve un mensaje si el cambio no se puede hacer (ej.: más de 100 combinaciones). */
  onChange: (option: FormOption) => string | null;
  onRemove: () => void;
}) {
  const ids = useId();
  const [draft, setDraft] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const isColor = isColorOption(option.name);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const exists = (text: string, exceptKey?: string) =>
    option.values.some((v) => v.key !== exceptKey && v.value.trim().toLowerCase() === text.toLowerCase());

  /** Agrega uno o varios valores (pegar una lista: uno por renglón). */
  function addValues(texts: string[]) {
    const clean = texts.map((t) => t.trim()).filter(Boolean);
    if (clean.length === 0) return;

    const added: FormOptionValue[] = [];
    const repeated: string[] = [];
    for (const text of clean) {
      if (text.length > 60) {
        setAddError("Cada valor puede tener hasta 60 caracteres.");
        return;
      }
      if (exists(text) || added.some((a) => a.value.toLowerCase() === text.toLowerCase())) {
        repeated.push(text);
        continue;
      }
      added.push({ key: newKey("val"), id: null, value: text, colorHex: isColor ? suggestColorHex(text) : null });
    }

    if (added.length > 0) {
      const problem = onChange({ ...option, values: [...option.values, ...added] });
      if (problem) {
        setAddError(problem);
        return;
      }
    }
    setDraft("");
    setAddError(repeated.length ? `Ya está: ${repeated.join(", ")}` : null);
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const from = option.values.findIndex((v) => v.key === active.id);
    const to = option.values.findIndex((v) => v.key === over.id);
    onChange({ ...option, values: arrayMove(option.values, from, to) });
  }

  /** Al escribir "Color" de nombre, sugerir muestras para los valores que no tienen. */
  function handleNameBlur() {
    if (!isColorOption(option.name)) return;
    if (option.values.every((v) => v.colorHex)) return;
    onChange({
      ...option,
      values: option.values.map((v) => (v.colorHex ? v : { ...v, colorHex: suggestColorHex(v.value) })),
    });
  }

  const nameError = errors[`options.${index}.name`];
  const valuesError =
    errors[`options.${index}.values`] ??
    option.values.map((_, j) => errors[`options.${index}.values.${j}`]).find(Boolean);

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-3 sm:p-4">
      <div className="flex items-end gap-2">
        <div className="flex flex-1 flex-col gap-1.5">
          <label htmlFor={`${ids}-name`} className="text-xs font-medium text-muted-foreground">
            Nombre de la opción
          </label>
          <Input
            id={`${ids}-name`}
            value={option.name}
            onChange={(e) => onChange({ ...option, name: e.target.value })}
            onBlur={handleNameBlur}
            placeholder="Ej.: Color, Medida, Material"
            maxLength={40}
            disabled={disabled}
            aria-invalid={Boolean(nameError) || undefined}
            className="max-w-xs"
          />
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onRemove}
          disabled={disabled}
          aria-label={`Quitar la opción ${option.name || index + 1}`}
          className="text-muted-foreground"
        >
          <Trash2 />
        </Button>
      </div>
      {nameError && <p className="-mt-1.5 text-xs text-destructive">{nameError}</p>}

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">Valores</span>
        <div className="flex flex-wrap items-center gap-1.5">
          <DndContext id={`${ids}-dnd`} sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={option.values.map((v) => v.key)} strategy={rectSortingStrategy}>
              <ul className="contents">
                {option.values.map((v, j) => (
                  <ValueChip
                    key={v.key}
                    value={v}
                    isColor={isColor}
                    error={errors[`options.${index}.values.${j}`]}
                    disabled={disabled}
                    onRename={(text) => {
                      if (!text) return "El valor no puede quedar vacío.";
                      if (exists(text, v.key)) return `Ya hay un valor «${text}».`;
                      onChange({
                        ...option,
                        values: option.values.map((x) => (x.key === v.key ? { ...x, value: text } : x)),
                      });
                      return null;
                    }}
                    onColorChange={(colorHex) =>
                      onChange({
                        ...option,
                        values: option.values.map((x) => (x.key === v.key ? { ...x, colorHex } : x)),
                      })
                    }
                    onRemove={() => onChange({ ...option, values: option.values.filter((x) => x.key !== v.key) })}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>

          <input
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              setAddError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault(); // que Enter no envíe el formulario
                addValues([draft]);
              }
            }}
            onPaste={(e) => {
              const text = e.clipboardData.getData("text");
              if (text.includes("\n")) {
                e.preventDefault();
                addValues(text.split(/\r?\n/));
              }
            }}
            onBlur={() => draft.trim() && addValues([draft])}
            placeholder={option.values.length ? "Agregar otro…" : isColor ? "Ej.: Rojo y Enter" : "Ej.: 12x30 cm y Enter"}
            maxLength={60}
            disabled={disabled}
            aria-label={`Agregar un valor a ${option.name || "la opción"}`}
            className="h-8 min-w-36 flex-1 rounded-full border border-dashed bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </div>
        {addError || valuesError ? (
          <p className="text-xs text-destructive">{addError ?? valuesError}</p>
        ) : (
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            {isColor && <Palette className="size-3" aria-hidden />}
            {isColor
              ? "Escribí y apretá Enter. Tocá el circulito para cambiar la muestra de color."
              : "Escribí y apretá Enter. Podés pegar una lista (un valor por renglón)."}
          </p>
        )}
      </div>
    </div>
  );
}
