"use client";

import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { X } from "lucide-react";
import { cn } from "cn";
import type { FormOptionValue } from "../types";

/**
 * Un valor de una opción como "chip": [●] Rojo ✕
 *   - Clic en el texto → se edita (renombrar conserva el código de barras).
 *   - Clic en el circulito (solo en la opción Color) → elegir el color.
 *   - Se arrastra para cambiar el orden.
 */
export function ValueChip({
  value,
  isColor,
  error,
  disabled,
  onRename,
  onColorChange,
  onRemove,
}: {
  value: FormOptionValue;
  isColor: boolean;
  error?: string;
  disabled?: boolean;
  /** Devuelve un mensaje si el nombre nuevo no sirve (ej.: repetido). */
  onRename: (text: string) => string | null;
  onColorChange: (hex: string) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: value.key,
    disabled,
  });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value.value);
  const [renameError, setRenameError] = useState<string | null>(null);

  function finishEditing(save: boolean) {
    if (save && draft.trim() !== value.value) {
      const problem = onRename(draft.trim());
      if (problem) {
        setRenameError(problem);
        return;
      }
    }
    setRenameError(null);
    setDraft(value.value);
    setEditing(false);
  }

  const invalid = Boolean(error || renameError);

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "flex h-8 items-center gap-1.5 rounded-full border bg-background pr-1 pl-2 text-sm",
        invalid && "border-destructive ring-2 ring-destructive/20",
        isDragging && "z-10 shadow-md",
      )}
      title={renameError ?? error}
    >
      {isColor && (
        <label
          className={cn(
            "relative size-4 shrink-0 cursor-pointer rounded-full border border-black/15",
            !value.colorHex && "border-dashed border-muted-foreground/50",
          )}
          style={value.colorHex ? { backgroundColor: value.colorHex } : undefined}
          title="Elegir el color de la muestra"
        >
          <input
            type="color"
            value={value.colorHex ?? "#ffffff"}
            onChange={(e) => onColorChange(e.target.value.toUpperCase())}
            disabled={disabled}
            className="absolute inset-0 size-full cursor-pointer opacity-0"
            aria-label={`Color de «${value.value}»`}
          />
        </label>
      )}

      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setRenameError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              finishEditing(true);
            } else if (e.key === "Escape") {
              e.preventDefault();
              finishEditing(false);
            }
          }}
          onBlur={() => finishEditing(true)}
          maxLength={60}
          size={Math.max(draft.length, 3)}
          aria-label="Nuevo nombre del valor"
          aria-invalid={invalid || undefined}
          className="min-w-0 bg-transparent outline-none"
        />
      ) : (
        <button
          type="button"
          {...attributes}
          {...listeners}
          onClick={() => !disabled && setEditing(true)}
          disabled={disabled}
          className="cursor-grab touch-none truncate rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40 active:cursor-grabbing"
          aria-label={`${value.value}. Clic para renombrar; arrastrá para mover.`}
        >
          {value.value}
        </button>
      )}

      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        className="flex size-6 items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
        aria-label={`Quitar «${value.value}»`}
      >
        <X className="size-3.5" aria-hidden />
      </button>
    </li>
  );
}
