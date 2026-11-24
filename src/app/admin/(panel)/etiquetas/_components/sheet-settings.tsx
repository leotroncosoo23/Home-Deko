"use client";

import { useId } from "react";
import { AlertTriangle } from "lucide-react";
import { cn } from "cn";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { COLUMN_CHOICES, ROW_CHOICES, computeGeometry, type LabelSettings } from "@/lib/labels/layout";

const mm = (n: number) => n.toLocaleString("es-AR", { maximumFractionDigits: 1 });

/**
 * Configuración de la hoja: grilla (columnas × filas) y "empezar en la
 * posición X", con una mini hoja para tocar la posición (las anteriores
 * se ven como "ya usadas").
 */
export function SheetSettings({
  settings,
  onChange,
}: {
  settings: LabelSettings;
  onChange: (next: LabelSettings) => void;
}) {
  const ids = useId();
  const geometry = computeGeometry(settings);
  const cells = settings.columns * settings.rows;

  // Al cambiar la grilla, la posición vuelve a 1 si ya no existe
  const setGrid = (patch: Partial<LabelSettings>) => {
    const next = { ...settings, ...patch };
    if (next.startAt > next.columns * next.rows) next.startAt = 1;
    onChange(next);
  };

  const columnItems = COLUMN_CHOICES.map((n) => ({ value: String(n), label: String(n) }));
  const rowItems = ROW_CHOICES.map((n) => ({ value: String(n), label: String(n) }));

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${ids}-cols`}>Columnas</Label>
          <Select items={columnItems} value={String(settings.columns)} onValueChange={(v) => v && setGrid({ columns: Number(v) })}>
            <SelectTrigger id={`${ids}-cols`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {columnItems.map((i) => (
                <SelectItem key={i.value} value={i.value}>
                  {i.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${ids}-rows`}>Filas</Label>
          <Select items={rowItems} value={String(settings.rows)} onValueChange={(v) => v && setGrid({ rows: Number(v) })}>
            <SelectTrigger id={`${ids}-rows`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {rowItems.map((i) => (
                <SelectItem key={i.value} value={i.value}>
                  {i.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <p className="-mt-2 text-xs text-muted-foreground tabular-nums">
        {cells} por hoja · etiqueta de {mm(geometry.labelW)} × {mm(geometry.labelH)} mm · código al {geometry.magnification} %
      </p>

      {geometry.problem && (
        <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden />
          {geometry.problem}
        </p>
      )}

      {/* Posición inicial */}
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-2">
          <span id={`${ids}-start`} className="text-sm font-medium">
            Empezar en la posición
          </span>
          <span className="text-sm font-semibold tabular-nums">{settings.startAt}</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Para reaprovechar una hoja ya usada: tocá la primera etiqueta libre.
        </p>
        <div
          role="radiogroup"
          aria-labelledby={`${ids}-start`}
          className="mx-auto grid w-full max-w-48 gap-0.5 rounded-md border bg-muted/40 p-1.5"
          style={{ gridTemplateColumns: `repeat(${settings.columns}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: cells }, (_, i) => {
            const position = i + 1;
            const used = position < settings.startAt;
            const selected = position === settings.startAt;
            return (
              <button
                key={position}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={`Posición ${position}`}
                onClick={() => onChange({ ...settings, startAt: position })}
                style={{ aspectRatio: `${geometry.labelW} / ${geometry.labelH}` }}
                className={cn(
                  "rounded-xs border outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/40",
                  selected
                    ? "border-brand bg-brand"
                    : used
                      ? "border-transparent bg-foreground/15 hover:bg-foreground/25"
                      : "border-foreground/15 bg-background hover:border-foreground/40",
                )}
              />
            );
          })}
        </div>
        {settings.startAt > 1 && (
          <button
            type="button"
            onClick={() => onChange({ ...settings, startAt: 1 })}
            className="self-center text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            Volver a la posición 1 (hoja nueva)
          </button>
        )}
      </div>
    </div>
  );
}
