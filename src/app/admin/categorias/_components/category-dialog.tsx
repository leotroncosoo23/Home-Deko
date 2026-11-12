"use client";

import { useId, useState, useTransition } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { slugify, SLUG_MAX_LENGTH } from "@/lib/slug";
import { saveCategory } from "../actions";
import type { Category, CategoryField } from "../types";
import { ImageField, type ImageValue } from "./image-field";

/**
 * Diálogo para crear (sin `category`) o editar (con `category`).
 * El formulario se arma de cero cada vez que se abre.
 */
export function CategoryDialog({
  open,
  onOpenChange,
  category,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category?: Category;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{category ? "Editar categoría" : "Nueva categoría"}</DialogTitle>
          <DialogDescription>
            {category
              ? "Los cambios se ven en la tienda apenas los guardás."
              : "Agrupá tus productos para que sea fácil encontrarlos en la tienda."}
          </DialogDescription>
        </DialogHeader>
        {/* key: si se abre para otra categoría, el formulario arranca limpio */}
        <CategoryForm
          key={category?.id ?? "new"}
          category={category}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function CategoryForm({ category, onDone }: { category?: Category; onDone: () => void }) {
  const isEdit = Boolean(category);
  const ids = useId();

  const [name, setName] = useState(category?.name ?? "");
  const [slug, setSlug] = useState(category?.slug ?? "");
  // Al crear, el slug se escribe solo mientras no lo toques a mano.
  // Al editar, nunca cambia solo (las URLs viejas dejarían de andar).
  const [slugTouched, setSlugTouched] = useState(isEdit);
  const [isVisible, setIsVisible] = useState(category?.isVisible ?? true);
  const [image, setImage] = useState<ImageValue>({ file: null, removed: false });
  const [errors, setErrors] = useState<Partial<Record<CategoryField, string>>>({});
  const [pending, startTransition] = useTransition();

  const slugChanged = isEdit && slug !== category?.slug;

  function handleNameChange(value: string) {
    setName(value);
    if (errors.name) setErrors((e) => ({ ...e, name: undefined }));
    if (!slugTouched) setSlug(slugify(value));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    // Validación rápida en el navegador (el servidor valida de nuevo).
    const cleanSlug = slugify(slug);
    setSlug(cleanSlug);
    const newErrors: typeof errors = {};
    if (!name.trim()) newErrors.name = "Escribí un nombre.";
    if (!cleanSlug) newErrors.slug = "Escribí un slug.";
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    const formData = new FormData();
    if (category) formData.set("id", category.id);
    formData.set("name", name.trim());
    formData.set("slug", cleanSlug);
    formData.set("isVisible", String(isVisible));
    if (image.file) formData.set("image", image.file);
    if (image.removed) formData.set("removeImage", "true");

    startTransition(async () => {
      try {
        const result = await saveCategory(formData);
        if (result.ok) {
          toast.success(isEdit ? "Cambios guardados" : "Categoría creada");
          onDone();
        } else {
          setErrors(result.fieldErrors ?? {});
          if (!result.fieldErrors) toast.error(result.error);
        }
      } catch {
        toast.error("No se pudo guardar. Revisá tu conexión e intentá de nuevo.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
      {/* Nombre */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${ids}-name`}>Nombre</Label>
        <Input
          id={`${ids}-name`}
          value={name}
          onChange={(e) => handleNameChange(e.target.value)}
          placeholder="Ej.: Cocina"
          maxLength={80}
          autoComplete="off"
          autoFocus
          disabled={pending}
          aria-invalid={Boolean(errors.name)}
          aria-describedby={errors.name ? `${ids}-name-error` : undefined}
        />
        {errors.name && (
          <p id={`${ids}-name-error`} className="text-xs text-destructive">
            {errors.name}
          </p>
        )}
      </div>

      {/* Slug */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${ids}-slug`}>Slug (dirección en la tienda)</Label>
        <div
          className={cn(
            "flex h-8 items-center overflow-hidden rounded-lg border border-input text-sm focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/20",
            errors.slug && "border-destructive ring-3 ring-destructive/20",
          )}
        >
          <span className="flex h-full items-center border-r bg-muted px-2.5 text-muted-foreground">
            /categoria/
          </span>
          <input
            id={`${ids}-slug`}
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value.toLowerCase());
              if (errors.slug) setErrors((er) => ({ ...er, slug: undefined }));
            }}
            onBlur={() => setSlug(slugify(slug))}
            placeholder="cocina"
            maxLength={SLUG_MAX_LENGTH}
            autoComplete="off"
            spellCheck={false}
            disabled={pending}
            aria-invalid={Boolean(errors.slug)}
            aria-describedby={`${ids}-slug-help`}
            className="h-full min-w-0 flex-1 bg-transparent px-2.5 outline-none disabled:opacity-50"
          />
        </div>
        {errors.slug ? (
          <p id={`${ids}-slug-help`} className="text-xs text-destructive">
            {errors.slug}
          </p>
        ) : slugChanged ? (
          <p id={`${ids}-slug-help`} className="flex gap-1.5 text-xs text-amber-700">
            <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden />
            Si cambiás el slug, los enlaces viejos a esta categoría dejan de funcionar.
          </p>
        ) : (
          <p id={`${ids}-slug-help`} className="text-xs text-muted-foreground">
            {isEdit
              ? "Solo minúsculas, números y guiones."
              : "Se completa solo con el nombre. Podés cambiarlo."}
          </p>
        )}
      </div>

      {/* Visible */}
      <div className="flex items-center justify-between gap-4 rounded-lg border px-3 py-2.5">
        <div className="flex flex-col gap-0.5">
          <Label htmlFor={`${ids}-visible`}>Visible en la tienda</Label>
          <p className="text-xs text-muted-foreground">
            Si la ocultás, no aparece en la tienda, pero no se pierde nada.
          </p>
        </div>
        <Switch
          id={`${ids}-visible`}
          checked={isVisible}
          onCheckedChange={setIsVisible}
          disabled={pending}
        />
      </div>

      {/* Imagen */}
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">
          Imagen <span className="font-normal text-muted-foreground">(opcional)</span>
        </span>
        <ImageField
          currentUrl={category?.imageUrl ?? null}
          value={image}
          onChange={(value) => {
            setImage(value);
            if (errors.image) setErrors((er) => ({ ...er, image: undefined }));
          }}
          error={errors.image}
          disabled={pending}
        />
      </div>

      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" disabled={pending} />}>
          Cancelar
        </DialogClose>
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}
          {pending ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear categoría"}
        </Button>
      </DialogFooter>
    </form>
  );
}
