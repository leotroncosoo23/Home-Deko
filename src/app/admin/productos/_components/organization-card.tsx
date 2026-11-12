"use client";

import Link from "next/link";
import { cn } from "cn";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { CategoryChoice, FormCardProps, ProductStatus } from "../types";
import { Field } from "./field";

const NO_CATEGORY = "none";

const STATUS_CHOICES: { value: ProductStatus; label: string; help: string }[] = [
  { value: "draft", label: "Borrador", help: "No se ve en la tienda. Ideal mientras lo cargás." },
  { value: "active", label: "Publicado", help: "Se ve en la tienda y se puede comprar." },
];

/** Estado, categoría y destacado (columna derecha). */
export function OrganizationCard({
  values,
  update,
  errors,
  disabled,
  categories,
}: FormCardProps & { categories: CategoryChoice[] }) {
  // "Archivado" solo aparece si el producto ya lo está (archivar es del paso 6).
  const choices =
    values.status === "archived"
      ? [...STATUS_CHOICES, { value: "archived" as const, label: "Archivado", help: "No se ve en la tienda ni en las búsquedas." }]
      : STATUS_CHOICES;
  const current = choices.find((c) => c.value === values.status);

  const items = [
    { value: NO_CATEGORY, label: "Sin categoría" },
    ...categories.map((c) => ({ value: c.id, label: c.isVisible ? c.name : `${c.name} (oculta)` })),
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Organización</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {/* Estado: botones tipo "segmento" */}
        <div className="flex flex-col gap-1.5">
          <Label id="product-status-label">Estado</Label>
          <div
            role="radiogroup"
            aria-labelledby="product-status-label"
            className="grid auto-cols-fr grid-flow-col gap-1 rounded-lg bg-muted p-1"
          >
            {choices.map((c) => {
              const selected = c.value === values.status;
              return (
                <button
                  key={c.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={disabled}
                  onClick={() => update({ status: c.value })}
                  className={cn(
                    "flex h-7 items-center justify-center gap-1.5 rounded-md text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50",
                    selected ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "size-1.5 rounded-full",
                      c.value === "active" ? "bg-emerald-500" : "bg-neutral-400",
                    )}
                    aria-hidden
                  />
                  {c.label}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">{current?.help}</p>
        </div>

        {/* Categoría */}
        <Field
          id="product-category"
          label="Categoría"
          error={errors.categoryId}
          help={
            categories.length === 0 ? (
              <>
                Todavía no hay categorías.{" "}
                <Link href="/admin/categorias" className="underline underline-offset-3 hover:text-foreground">
                  Crear una
                </Link>
              </>
            ) : undefined
          }
        >
          <Select
            items={items}
            value={values.categoryId ?? NO_CATEGORY}
            onValueChange={(value) => update({ categoryId: !value || value === NO_CATEGORY ? null : String(value) })}
            disabled={disabled}
          >
            <SelectTrigger
              id="product-category"
              className="w-full"
              aria-invalid={Boolean(errors.categoryId) || undefined}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {items.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        {/* Destacado */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-0.5">
            <Label htmlFor="product-featured">Destacado</Label>
            <p className="text-xs text-muted-foreground">Se muestra primero en la tienda.</p>
          </div>
          <Switch
            id="product-featured"
            checked={values.isFeatured}
            onCheckedChange={(isFeatured) => update({ isFeatured })}
            disabled={disabled}
          />
        </div>
      </CardContent>
    </Card>
  );
}
