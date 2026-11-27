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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { slugify, SLUG_MAX_LENGTH } from "@/lib/slug";
import { saveCategory } from "../actions";
import type { Category, CategoryField } from "../types";
import { ImageField, type ImageValue } from "@/components/admin/image-field";

const NO_PARENT = "__principal__";

/**
 * Diálogo para crear (sin `category`) o editar (con `category`) una
 * categoría principal o una subcategoría.
 * `defaultParentId`: "+ Subcategoría" de una principal la deja elegida.
 * El formulario se arma de cero cada vez que se abre.
 */
export function CategoryDialog({
  open,
  onOpenChange,
  category,
  categories,
  defaultParentId = null,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category?: Category;
  /** Todas las categorías (para "Pertenece a" y saber si tiene subcategorías). */
  categories: Category[];
  defaultParentId?: string | null;
}) {
  const isSub = category ? category.parentId !== null : defaultParentId !== null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {category
              ? isSub
                ? "Editar subcategoría"
                : "Editar categoría"
              : isSub
                ? "Nueva subcategoría"
                : "Nueva categoría"}
          </DialogTitle>
          <DialogDescription>
            {category
              ? "Los cambios se ven en la tienda apenas los guardás."
              : isSub
                ? "Separá los productos de una categoría en grupos más chicos (ej.: Cocina › Utensilios)."
                : "Agrupá tus productos para que sea fácil encontrarlos en la tienda."}
          </DialogDescription>
        </DialogHeader>
        {/* key: si se abre para otra categoría, el formulario arranca limpio */}
        <CategoryForm
          key={category?.id ?? `new-${defaultParentId ?? ""}`}
          category={category}
          categories={categories}
          defaultParentId={defaultParentId}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function CategoryForm({
  category,
  categories,
  defaultParentId,
  onDone,
}: {
  category?: Category;
  categories: Category[];
  defaultParentId: string | null;
  onDone: () => void;
}) {
  const isEdit = Boolean(category);
  const ids = useId();

  const [name, setName] = useState(category?.name ?? "");
  const [slug, setSlug] = useState(category?.slug ?? "");
  // Al crear, el slug se escribe solo mientras no lo toques a mano.
  // Al editar, nunca cambia solo (las URLs viejas dejarían de andar).
  const [slugTouched, setSlugTouched] = useState(isEdit);
  const [parentId, setParentId] = useState<string | null>(category ? category.parentId : defaultParentId);
  const [isVisible, setIsVisible] = useState(category?.isVisible ?? true);
  const [image, setImage] = useState<ImageValue>({ file: null, removed: false });
  const [errors, setErrors] = useState<Partial<Record<CategoryField, string>>>({});
  const [pending, startTransition] = useTransition();

  // Con subcategorías propias, sigue siendo principal (un solo nivel).
  const subCount = category ? categories.filter((c) => c.parentId === category.id).length : 0;
  const mains = categories.filter((c) => c.parentId === null && c.id !== category?.id);
  const parent = parentId ? (categories.find((c) => c.id === parentId) ?? null) : null;
  const parentItems = [
    { value: NO_PARENT, label: "Ninguna (categoría principal)" },
    ...mains.map((c) => ({ value: c.id, label: c.isVisible ? c.name : `${c.name} (oculta)` })),
  ];

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
    // Sin tocar el slug, si ya existe se usa uno libre (utensilios-2).
    if (!isEdit && !slugTouched) formData.set("slugAuto", "true");
    formData.set("parentId", parentId ?? "");
    formData.set("isVisible", String(isVisible));
    if (!parentId && image.file) formData.set("image", image.file);
    if (image.removed) formData.set("removeImage", "true");

    startTransition(async () => {
      try {
        const result = await saveCategory(formData);
        if (result.ok) {
          toast.success(isEdit ? "Cambios guardados" : parentId ? "Subcategoría creada" : "Categoría creada");
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

  let parentHelp: string;
  if (subCount > 0) {
    parentHelp = `Tiene ${subCount === 1 ? "1 subcategoría" : `${subCount} subcategorías`}: sigue siendo una categoría principal.`;
  } else if (parent) {
    parentHelp = `En la tienda se ve como ${parent.name} › ${name.trim() || "…"}.`;
  } else {
    parentHelp = "Principal: aparece en el menú de la tienda.";
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
          placeholder={parent ? "Ej.: Utensilios" : "Ej.: Cocina"}
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

      {/* Pertenece a (ninguna = principal) */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${ids}-parent`}>Pertenece a</Label>
        <Select
          items={parentItems}
          value={parentId ?? NO_PARENT}
          onValueChange={(value) => {
            setParentId(!value || value === NO_PARENT ? null : String(value));
            if (errors.parent) setErrors((er) => ({ ...er, parent: undefined }));
          }}
          disabled={pending || subCount > 0}
        >
          <SelectTrigger
            id={`${ids}-parent`}
            className="w-full"
            aria-invalid={Boolean(errors.parent) || undefined}
            aria-describedby={`${ids}-parent-help`}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {parentItems.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p id={`${ids}-parent-help`} className={cn("text-xs", errors.parent ? "text-destructive" : "text-muted-foreground")}>
          {errors.parent ?? parentHelp}
        </p>
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
          <span className="flex h-full max-w-[55%] items-center truncate border-r bg-muted px-2.5 text-muted-foreground">
            {parent ? `/categorias/${parent.slug}/` : "/categorias/"}
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
            placeholder={parent ? "utensilios" : "cocina"}
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
            {parent
              ? "Si la ocultás, ni la subcategoría ni sus productos aparecen en la tienda, pero no se pierde nada."
              : "Si la ocultás, ni la categoría (con sus subcategorías) ni sus productos aparecen en la tienda, pero no se pierde nada."}
          </p>
        </div>
        <Switch
          id={`${ids}-visible`}
          checked={isVisible}
          onCheckedChange={setIsVisible}
          disabled={pending}
        />
      </div>

      {/* Foto de portada: solo principales (tarjeta del inicio y mega menú de la tienda) */}
      {!parentId ? (
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">
            Foto de portada <span className="font-normal text-muted-foreground">(opcional)</span>
          </span>
          <span className="text-[13px] text-muted-foreground">
            Se ve en la tarjeta de la categoría en el inicio y en el menú de la tienda (PC). Mejor una foto horizontal.
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
      ) : (
        category?.imageUrl && (
          <p className="text-xs text-muted-foreground">
            Las subcategorías no llevan foto de portada: al guardar, se quita la que tenía.
          </p>
        )
      )}

      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" disabled={pending} />}>
          Cancelar
        </DialogClose>
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}
          {pending
            ? "Guardando…"
            : isEdit
              ? "Guardar cambios"
              : parentId
                ? "Crear subcategoría"
                : "Crear categoría"}
        </Button>
      </DialogFooter>
    </form>
  );
}
