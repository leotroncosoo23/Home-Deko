"use client";

import { useState, useTransition } from "react";
import { EyeOff, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { CategoryPicker } from "@/components/admin/category-picker";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { deleteCategory, setCategoryVisibility } from "../actions";
import type { Category } from "../types";

const NO_CATEGORY = "__sin_categoria__";
const AS_MAIN = "__principales__";

/**
 * Confirmación antes de eliminar.
 *   - Sin productos ni subcategorías → "¿Eliminar?".
 *   - Con productos y/o subcategorías → dice cuántos y ofrece moverlos antes:
 *       productos → otra categoría (o "Sin categoría");
 *       subcategorías → pasan a ser principales, o a otra principal.
 *     También se puede ocultar en lugar de eliminar.
 */
export function DeleteCategoryDialog({
  category,
  categories,
  open,
  onOpenChange,
}: {
  /** La categoría a eliminar. Se conserva al cerrar, para la animación. */
  category: Category | null;
  categories: Category[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-md">
        {category && (
          <DeleteContent
            key={category.id}
            category={category}
            categories={categories}
            onDone={() => onOpenChange(false)}
          />
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}

const count = (n: number, one: string, many: string) => (n === 1 ? `1 ${one}` : `${n} ${many}`);

function DeleteContent({
  category,
  categories,
  onDone,
}: {
  category: Category;
  categories: Category[];
  onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const subs = categories.filter((c) => c.parentId === category.id);
  const hasProducts = category.productCount > 0;
  const hasSubs = subs.length > 0;
  const kind = category.parentId ? "subcategoría" : "categoría";

  // Destino de los productos: por defecto, la principal (si es subcategoría).
  const [productsTo, setProductsTo] = useState<string | null>(category.parentId ?? null);
  const [subsTo, setSubsTo] = useState<string>(AS_MAIN);
  const excluded = [category.id, ...subs.map((s) => s.id)];

  function handleDelete() {
    startTransition(async () => {
      try {
        const result = await deleteCategory(
          category.id,
          hasProducts || hasSubs
            ? {
                productsTo: productsTo === NO_CATEGORY ? null : productsTo,
                subcategoriesTo: subsTo === AS_MAIN ? "main" : subsTo,
              }
            : undefined,
        );
        if (result.ok) {
          toast.success(category.parentId ? "Subcategoría eliminada" : "Categoría eliminada");
          onDone();
        } else {
          toast.error(result.error);
          if (result.productCount) onDone();
        }
      } catch {
        toast.error("No se pudo eliminar. Revisá tu conexión e intentá de nuevo.");
      }
    });
  }

  function handleHide() {
    startTransition(async () => {
      try {
        const result = await setCategoryVisibility(category.id, false);
        if (result.ok) {
          toast.success(`«${category.name}» ya no se muestra en la tienda`);
          onDone();
        } else {
          toast.error(result.error);
        }
      } catch {
        toast.error("No se pudo ocultar. Revisá tu conexión e intentá de nuevo.");
      }
    });
  }

  const needsMove = hasProducts || hasSubs;
  const contents = [
    hasProducts && count(category.productCount, "producto", "productos"),
    hasSubs && count(subs.length, "subcategoría", "subcategorías"),
  ]
    .filter(Boolean)
    .join(" y ");

  return (
    <>
      <AlertDialogHeader>
        <AlertDialogMedia className="bg-destructive/10">
          <Trash2 className="text-destructive" />
        </AlertDialogMedia>
        <AlertDialogTitle>
          ¿Eliminar {kind} «{category.name}»?
        </AlertDialogTitle>
        <AlertDialogDescription>
          {needsMove
            ? `Tiene ${contents} (contando borradores y archivados). Elegí a dónde moverlos antes de eliminarla.`
            : `La ${kind} se borra definitivamente${category.imageUrl ? ", junto con su imagen" : ""}. Esto no se puede deshacer.`}
        </AlertDialogDescription>
      </AlertDialogHeader>

      {needsMove && (
        <div className="flex flex-col gap-4">
          {hasProducts && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="delete-products-to">Mover {count(category.productCount, "producto", "productos")} a</Label>
              <CategoryPicker
                id="delete-products-to"
                categories={categories}
                exclude={excluded}
                extraOptions={[{ value: NO_CATEGORY, label: "Sin categoría" }]}
                value={productsTo ?? NO_CATEGORY}
                onChange={(v) => setProductsTo(v)}
                disabled={pending}
              />
            </div>
          )}
          {hasSubs && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="delete-subs-to">Sus {count(subs.length, "subcategoría", "subcategorías")}</Label>
              <CategoryPicker
                id="delete-subs-to"
                categories={categories}
                onlyMains
                exclude={[category.id]}
                extraOptions={[{ value: AS_MAIN, label: "Pasan a ser categorías principales" }]}
                value={subsTo}
                onChange={(v) => setSubsTo(v ?? AS_MAIN)}
                disabled={pending}
              />
              <p className="text-xs text-muted-foreground">
                {subs.map((s) => s.name).join(", ")} — con sus productos.
              </p>
            </div>
          )}
        </div>
      )}

      <AlertDialogFooter className="sm:justify-between">
        {needsMove && category.isVisible ? (
          <AlertDialogAction variant="ghost" onClick={handleHide} disabled={pending} className="text-muted-foreground">
            <EyeOff /> Mejor ocultarla
          </AlertDialogAction>
        ) : (
          <span className="hidden sm:block" />
        )}
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
          {/* Acción destructiva: botón con borde rojo (ver CLAUDE.md) */}
          <AlertDialogAction
            variant="outline"
            onClick={handleDelete}
            disabled={pending}
            className="border-destructive/40 text-destructive hover:bg-destructive/5 hover:text-destructive"
          >
            {pending ? <Loader2 className="animate-spin" /> : <Trash2 />}
            {pending ? "Eliminando…" : needsMove ? "Mover y eliminar" : "Eliminar"}
          </AlertDialogAction>
        </div>
      </AlertDialogFooter>
    </>
  );
}
