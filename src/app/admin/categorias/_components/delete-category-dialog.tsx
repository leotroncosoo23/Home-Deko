"use client";

import { useTransition } from "react";
import { EyeOff, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
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
import { deleteCategory, setCategoryVisibility } from "../actions";
import type { Category } from "../types";

/**
 * Confirmación antes de eliminar.
 *   - Sin productos → "¿Eliminar?" con el botón Eliminar.
 *   - Con productos → explica por qué no se puede y ofrece ocultarla.
 */
export function DeleteCategoryDialog({
  category,
  open,
  onOpenChange,
}: {
  /** La categoría a eliminar. Se conserva al cerrar, para la animación. */
  category: Category | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        {category && (
          <DeleteContent
            key={category.id}
            category={category}
            onDone={() => onOpenChange(false)}
          />
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}

function DeleteContent({ category, onDone }: { category: Category; onDone: () => void }) {
  const [pending, startTransition] = useTransition();
  const hasProducts = category.productCount > 0;
  const productsText =
    category.productCount === 1 ? "1 producto" : `${category.productCount} productos`;

  function handleDelete() {
    startTransition(async () => {
      try {
        const result = await deleteCategory(category.id);
        if (result.ok) {
          toast.success("Categoría eliminada");
          onDone();
        } else {
          toast.error(result.error);
          // Si resultó que sí tenía productos, cerrar: el listado se
          // actualiza y la próxima vez se ofrece ocultarla.
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

  if (hasProducts) {
    return (
      <>
        <AlertDialogHeader>
          <AlertDialogMedia>
            <EyeOff className="text-muted-foreground" />
          </AlertDialogMedia>
          <AlertDialogTitle>No se puede eliminar «{category.name}»</AlertDialogTitle>
          <AlertDialogDescription>
            Tiene {productsText} (contando borradores y archivados). Para eliminarla, primero
            pasá esos productos a otra categoría.
            {category.isVisible
              ? " Si solo querés que no se vea, podés ocultarla: los productos no se tocan."
              : " Ya está oculta, así que no aparece en la tienda."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          {category.isVisible ? (
            <>
              <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleHide} disabled={pending}>
                {pending ? <Loader2 className="animate-spin" /> : <EyeOff />}
                Ocultar categoría
              </AlertDialogAction>
            </>
          ) : (
            <AlertDialogCancel>Entendido</AlertDialogCancel>
          )}
        </AlertDialogFooter>
      </>
    );
  }

  return (
    <>
      <AlertDialogHeader>
        <AlertDialogMedia className="bg-destructive/10">
          <Trash2 className="text-destructive" />
        </AlertDialogMedia>
        <AlertDialogTitle>¿Eliminar «{category.name}»?</AlertDialogTitle>
        <AlertDialogDescription>
          La categoría se borra definitivamente{category.imageUrl ? ", junto con su imagen" : ""}.
          Esto no se puede deshacer.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
        {/* Acción destructiva: botón con borde rojo (ver CLAUDE.md) */}
        <AlertDialogAction
          variant="outline"
          onClick={handleDelete}
          disabled={pending}
          className="border-destructive/40 text-destructive hover:bg-destructive/5 hover:text-destructive"
        >
          {pending ? <Loader2 className="animate-spin" /> : <Trash2 />}
          {pending ? "Eliminando…" : "Eliminar"}
        </AlertDialogAction>
      </AlertDialogFooter>
    </>
  );
}
