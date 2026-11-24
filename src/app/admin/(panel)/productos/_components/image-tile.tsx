"use client";

import Image from "next/image";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AlertCircle, Loader2, RotateCcw, Star, Trash2 } from "lucide-react";
import { cn } from "cn";
import type { FormImage, FormOptionValue } from "../types";

/**
 * Una foto del producto en la grilla: se arrastra para ordenar.
 * La primera es la principal. Muestra si está subiendo o si falló.
 */
export function ImageTile({
  image,
  index,
  colorValues,
  disabled,
  onMakePrimary,
  onRemove,
  onRetry,
  onColorChange,
}: {
  image: FormImage;
  index: number;
  /** Valores de la opción Color (vacío si el producto no tiene). */
  colorValues: FormOptionValue[];
  disabled: boolean;
  onMakePrimary: () => void;
  onRemove: () => void;
  onRetry: () => void;
  onColorChange: (key: string | null) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: image.uid,
    disabled: disabled || image.uploading,
  });
  const isPrimary = index === 0;
  const src = image.url || image.previewUrl;
  const color = colorValues.find((v) => v.key === image.colorValueKey);

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "group relative flex flex-col gap-1.5",
        isPrimary && "col-span-2 row-span-2",
        isDragging && "z-10",
      )}
    >
      {/* La foto (se arrastra desde acá) */}
      <div
        {...attributes}
        {...listeners}
        aria-label={`Foto ${index + 1}${isPrimary ? " (principal)" : ""}. Arrastrá para cambiar el orden.`}
        className={cn(
          "relative aspect-square cursor-grab overflow-hidden rounded-lg border bg-muted outline-none focus-visible:ring-3 focus-visible:ring-ring/40 active:cursor-grabbing",
          isDragging && "shadow-lg ring-2 ring-foreground/10",
          image.error && "border-destructive/50",
        )}
      >
        {src && (
          <Image
            src={src}
            alt=""
            fill
            sizes={isPrimary ? "(min-width: 1024px) 320px, 50vw" : "(min-width: 1024px) 160px, 25vw"}
            className={cn("object-cover", (image.uploading || image.error) && "opacity-50")}
            unoptimized={src.startsWith("blob:")}
            draggable={false}
          />
        )}

        {isPrimary && !image.uploading && (
          <span className="absolute top-2 left-2 rounded-md bg-background/90 px-1.5 py-0.5 text-[11px] font-medium shadow-sm">
            Principal
          </span>
        )}

        {image.uploading && (
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex items-center gap-1.5 rounded-md bg-background/90 px-2 py-1 text-xs font-medium shadow-sm">
              <Loader2 className="size-3.5 animate-spin" aria-hidden /> Subiendo…
            </span>
          </span>
        )}

        {image.error && (
          <span className="absolute inset-x-2 bottom-2 flex items-start gap-1 rounded-md bg-background/95 px-2 py-1 text-[11px] text-destructive shadow-sm">
            <AlertCircle className="mt-px size-3 shrink-0" aria-hidden /> {image.error}
          </span>
        )}

        {/* Muestra del color asociado */}
        {color?.colorHex && !image.error && (
          <span
            className="absolute right-2 bottom-2 size-4 rounded-full border-2 border-background shadow-sm"
            style={{ backgroundColor: color.colorHex }}
            title={color.value}
            aria-hidden
          />
        )}
      </div>

      {/* Acciones (siempre visibles: en el celular no hay "pasar el mouse") */}
      <div className="absolute top-1.5 right-1.5 flex gap-1">
        {image.error ? (
          <TileButton label="Reintentar" onClick={onRetry} disabled={disabled}>
            <RotateCcw />
          </TileButton>
        ) : (
          !isPrimary &&
          !image.uploading && (
            <TileButton label="Hacer principal" onClick={onMakePrimary} disabled={disabled}>
              <Star />
            </TileButton>
          )
        )}
        <TileButton label="Quitar foto" onClick={onRemove} disabled={disabled}>
          <Trash2 />
        </TileButton>
      </div>

      {/* Asociar a un color (si el producto tiene la opción Color) */}
      {colorValues.length > 0 && !image.error && (
        <select
          value={image.colorValueKey ?? ""}
          onChange={(e) => onColorChange(e.target.value || null)}
          disabled={disabled}
          aria-label={`Color de la foto ${index + 1}`}
          className="h-7 w-full min-w-0 rounded-md border border-input bg-background px-1.5 text-xs text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
        >
          <option value="">Todos los colores</option>
          {colorValues.map((v) => (
            <option key={v.key} value={v.key}>
              {v.value}
            </option>
          ))}
        </select>
      )}
    </li>
  );
}

function TileButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="flex size-7 items-center justify-center rounded-md bg-background/90 text-muted-foreground shadow-sm outline-none hover:bg-background hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/40 disabled:opacity-50 [&_svg]:size-3.5"
    >
      {children}
    </button>
  );
}
