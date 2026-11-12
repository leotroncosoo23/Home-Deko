"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { cn } from "cn";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { slugify, SLUG_MAX_LENGTH } from "@/lib/slug";
import type { FormCardProps } from "../types";
import { Field, fieldProps } from "./field";

/** Nombre, slug y descripción. */
export function GeneralCard({ values, update, errors, disabled }: FormCardProps) {
  // Igual que en categorías: al crear, el slug se escribe solo hasta que
  // lo toques; al editar, nunca cambia solo (romperías los enlaces).
  const [slugTouched, setSlugTouched] = useState(!values.isNew);
  const [originalSlug] = useState(values.slug);
  const slugChanged = !values.isNew && values.slug !== originalSlug;

  return (
    <Card>
      <CardHeader>
        <CardTitle>General</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <Field id="product-name" label="Nombre" error={errors.name}>
          <Input
            {...fieldProps("product-name", errors.name)}
            value={values.name}
            onChange={(e) => {
              const name = e.target.value;
              update(slugTouched ? { name } : { name, slug: slugify(name) });
            }}
            placeholder="Ej.: Taza de cerámica esmaltada"
            maxLength={120}
            autoComplete="off"
            disabled={disabled}
          />
        </Field>

        <Field
          id="product-slug"
          label="Slug (dirección en la tienda)"
          error={errors.slug}
          help={
            slugChanged ? (
              <span className="flex gap-1.5 text-amber-700">
                <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden />
                Si cambiás el slug, los enlaces viejos a este producto dejan de funcionar.
              </span>
            ) : values.isNew ? (
              "Se completa solo con el nombre. Podés cambiarlo."
            ) : (
              "Solo minúsculas, números y guiones."
            )
          }
        >
          <div
            className={cn(
              "flex h-8 items-center overflow-hidden rounded-lg border border-input text-sm focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
              errors.slug && "border-destructive ring-3 ring-destructive/20",
            )}
          >
            <span className="flex h-full items-center border-r bg-muted px-2.5 text-muted-foreground">
              /producto/
            </span>
            <input
              {...fieldProps("product-slug", errors.slug, true)}
              value={values.slug}
              onChange={(e) => {
                setSlugTouched(true);
                update({ slug: e.target.value.toLowerCase() });
              }}
              onBlur={() => update({ slug: slugify(values.slug) })}
              placeholder="taza-de-ceramica"
              maxLength={SLUG_MAX_LENGTH}
              autoComplete="off"
              spellCheck={false}
              disabled={disabled}
              className="h-full min-w-0 flex-1 bg-transparent px-2.5 outline-none disabled:opacity-50"
            />
          </div>
        </Field>

        <Field
          id="product-description"
          label="Descripción"
          optional
          error={errors.description}
          help="Medidas, material, cuidados… Lo que ayuda a decidir la compra."
        >
          <Textarea
            {...fieldProps("product-description", errors.description, true)}
            value={values.description}
            onChange={(e) => update({ description: e.target.value })}
            rows={5}
            maxLength={5000}
            disabled={disabled}
          />
        </Field>
      </CardContent>
    </Card>
  );
}
