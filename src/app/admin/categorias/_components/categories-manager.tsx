"use client";

import { useOptimistic, useState, useTransition } from "react";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { restrictToParentElement, restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { toast } from "sonner";
import { reorderCategories, setCategoryVisibility } from "../actions";
import type { Category } from "../types";
import { CategoryDialog } from "./category-dialog";
import { CategoryRow } from "./category-row";
import { DeleteCategoryDialog } from "./delete-category-dialog";

/**
 * Listado de categorías con arrastrar y soltar.
 *
 * Orden "optimista": al soltar, la lista cambia AL INSTANTE (sin esperar
 * al servidor). Mientras se guarda, se muestra ese orden; si el servidor
 * falla, React vuelve solo al orden anterior y avisamos con un toast.
 */
export function CategoriesManager({ categories }: { categories: Category[] }) {
  const [items, setOptimisticItems] = useOptimistic(categories);
  const [, startTransition] = useTransition();

  // Diálogos. La categoría se guarda aparte del "abierto" para que el
  // contenido no desaparezca durante la animación de cierre.
  const [editing, setEditing] = useState<Category | undefined>(undefined);
  const [editOpen, setEditOpen] = useState(false);
  const [deleting, setDeleting] = useState<Category | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const sensors = useSensors(
    // Mouse y dedo: empieza a arrastrar después de moverse 4 px (así un
    // simple toque en la manija no cuenta como arrastre).
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    // Teclado: espacio para agarrar, flechas para mover, espacio para soltar.
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const from = items.findIndex((c) => c.id === active.id);
    const to = items.findIndex((c) => c.id === over.id);
    const next = arrayMove(items, from, to);

    startTransition(async () => {
      setOptimisticItems(next);
      try {
        const result = await reorderCategories(next.map((c) => c.id));
        if (result.ok) toast.success("Orden guardado");
        else toast.error(result.error);
      } catch {
        toast.error("No se pudo guardar el orden. Revisá tu conexión.");
      }
    });
  }

  function handleToggleVisibility(category: Category) {
    const nextVisible = !category.isVisible;
    startTransition(async () => {
      // También optimista: el badge cambia al instante.
      setOptimisticItems((list) =>
        list.map((c) => (c.id === category.id ? { ...c, isVisible: nextVisible } : c)),
      );
      try {
        const result = await setCategoryVisibility(category.id, nextVisible);
        if (result.ok) {
          toast.success(
            nextVisible
              ? `«${category.name}» ahora se muestra en la tienda`
              : `«${category.name}» ya no se muestra en la tienda`,
          );
        } else {
          toast.error(result.error);
        }
      } catch {
        toast.error("No se pudo guardar. Revisá tu conexión.");
      }
    });
  }

  return (
    <>
      <div className="overflow-hidden rounded-xl border bg-background">
        {/* Encabezado de columnas (desde tablet) */}
        <div className="hidden grid-cols-[auto_auto_1fr_7rem_6rem_auto] items-center gap-3 border-b bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground sm:grid">
          <span className="w-7" />
          <span className="w-10" />
          <span>Categoría</span>
          <span>Productos</span>
          <span>Estado</span>
          <span className="w-8" />
        </div>

        <DndContext
          id="categorias-dnd" // id fijo: evita diferencias entre servidor y navegador
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis, restrictToParentElement]}
          onDragEnd={handleDragEnd}
          accessibility={{ announcements: announcements(items), screenReaderInstructions }}
        >
          <SortableContext items={items.map((c) => c.id)} strategy={verticalListSortingStrategy}>
            <ul className="divide-y">
              {items.map((category) => (
                <CategoryRow
                  key={category.id}
                  category={category}
                  onEdit={() => {
                    setEditing(category);
                    setEditOpen(true);
                  }}
                  onToggleVisibility={() => handleToggleVisibility(category)}
                  onDelete={() => {
                    setDeleting(category);
                    setDeleteOpen(true);
                  }}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        Arrastrá desde ⠿ para cambiar el orden en que se muestran en la tienda.
      </p>

      <CategoryDialog open={editOpen} onOpenChange={setEditOpen} category={editing} />
      <DeleteCategoryDialog category={deleting} open={deleteOpen} onOpenChange={setDeleteOpen} />
    </>
  );
}

// ---------------------------------------------------------------------
// Textos para lectores de pantalla (en español)
// ---------------------------------------------------------------------

const screenReaderInstructions = {
  draggable:
    "Para mover una categoría, presioná espacio. Usá las flechas para cambiarla de lugar y espacio otra vez para soltarla. Escape cancela.",
};

function announcements(items: Category[]): Announcements {
  const name = (id: string | number) => items.find((c) => c.id === id)?.name ?? "la categoría";
  const position = (id: string | number) => items.findIndex((c) => c.id === id) + 1;
  return {
    onDragStart: ({ active }) => `Agarraste «${name(active.id)}».`,
    onDragOver: ({ active, over }) =>
      over ? `«${name(active.id)}» está en la posición ${position(over.id)} de ${items.length}.` : undefined,
    onDragEnd: ({ active, over }) =>
      over ? `Soltaste «${name(active.id)}» en la posición ${position(over.id)}.` : undefined,
    onDragCancel: ({ active }) => `Se canceló. «${name(active.id)}» quedó donde estaba.`,
  };
}
