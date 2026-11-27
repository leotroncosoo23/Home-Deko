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
  type CollisionDetection,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { buildCategoryTree, moveItem } from "@/lib/categories";
import { reorderCategories, setCategoryVisibility } from "../actions";
import type { Category } from "../types";
import { CategoryDialog } from "./category-dialog";
import { CategoryRow, DragHandleButton, ROW_GRID, type DragHandle } from "./category-row";
import { DeleteCategoryDialog } from "./delete-category-dialog";

/**
 * Árbol de categorías: cada principal y, debajo e indentadas, sus
 * subcategorías, con la cantidad de productos.
 *
 *   - Ordenar: arrastrando desde ⠿ (PC) o con ↑ ↓ (celular). Las principales
 *     se mueven con sus subcategorías; una subcategoría se mueve dentro de
 *     su principal (para pasarla a otra, "Editar" → "Pertenece a").
 *   - "+ Subcategoría" debajo de cada principal.
 *
 * Orden "optimista": la lista cambia AL INSTANTE (sin esperar al
 * servidor). Si el servidor falla, React vuelve solo al orden anterior y
 * avisamos con un toast.
 */
export function CategoriesManager({ categories }: { categories: Category[] }) {
  const [items, setOptimisticItems] = useOptimistic(categories);
  const [, startTransition] = useTransition();
  const tree = buildCategoryTree(items);

  // Diálogos. La categoría se guarda aparte del "abierto" para que el
  // contenido no desaparezca durante la animación de cierre.
  const [editing, setEditing] = useState<Category | undefined>(undefined);
  const [newParentId, setNewParentId] = useState<string | null>(null);
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

  /** Grupo de una categoría: "main" (principales) o el id de su principal. */
  const groupOf = (id: string | number) => {
    const c = items.find((x) => x.id === id);
    return c ? (c.parentId ?? "main") : null;
  };

  // Solo se puede soltar entre categorías del mismo grupo.
  const collisionDetection: CollisionDetection = (args) =>
    closestCenter({
      ...args,
      droppableContainers: args.droppableContainers.filter((d) => groupOf(d.id) === groupOf(args.active.id)),
    });

  /** Guarda el orden nuevo de un grupo (ids en orden). */
  function saveGroupOrder(groupIds: string[]) {
    // Lista plana nueva: los lugares del grupo se llenan en el orden nuevo; el resto queda igual.
    const inGroup = new Set(groupIds);
    const ordered = groupIds.map((id) => items.find((c) => c.id === id)!);
    let k = 0;
    const next = items.map((c) => (inGroup.has(c.id) ? ordered[k++] : c));

    startTransition(async () => {
      setOptimisticItems(next);
      try {
        const result = await reorderCategories(groupIds);
        if (result.ok) toast.success("Orden guardado");
        else toast.error(result.error);
      } catch {
        toast.error("No se pudo guardar el orden. Revisá tu conexión.");
      }
    });
  }

  function idsOfGroup(group: string): string[] {
    return items.filter((c) => (c.parentId ?? "main") === group).map((c) => c.id);
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const group = groupOf(active.id);
    if (!group || group !== groupOf(over.id)) return;
    const ids = idsOfGroup(group);
    saveGroupOrder(moveItem(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id))));
  }

  function handleMove(category: Category, direction: -1 | 1) {
    const ids = idsOfGroup(category.parentId ?? "main");
    const from = ids.indexOf(category.id);
    saveGroupOrder(moveItem(ids, from, from + direction));
  }

  function handleToggleVisibility(category: Category) {
    const nextVisible = !category.isVisible;
    startTransition(async () => {
      // También optimista: el badge cambia al instante.
      setOptimisticItems((list) => list.map((c) => (c.id === category.id ? { ...c, isVisible: nextVisible } : c)));
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

  function openEdit(category: Category) {
    setEditing(category);
    setNewParentId(null);
    setEditOpen(true);
  }

  function openNewSub(parentId: string) {
    setEditing(undefined);
    setNewParentId(parentId);
    setEditOpen(true);
  }

  function openDelete(category: Category) {
    setDeleting(category);
    setDeleteOpen(true);
  }

  const rowProps = (category: Category, siblings: Category[], index: number) => ({
    category,
    canMoveUp: index > 0,
    canMoveDown: index < siblings.length - 1,
    onMove: (direction: -1 | 1) => handleMove(category, direction),
    onEdit: () => openEdit(category),
    onToggleVisibility: () => handleToggleVisibility(category),
    onDelete: () => openDelete(category),
  });

  return (
    <>
      <div className="overflow-hidden surface-card">
        {/* Encabezado de columnas (desde tablet) */}
        <div className={`${ROW_GRID} hidden border-b bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground sm:grid`}>
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
          collisionDetection={collisionDetection}
          modifiers={[restrictToVerticalAxis]}
          onDragEnd={handleDragEnd}
          accessibility={{ announcements: announcements(items), screenReaderInstructions }}
        >
          <SortableContext items={tree.map((m) => m.id)} strategy={verticalListSortingStrategy}>
            <ul className="divide-y">
              {tree.map((main, i) => (
                <SortableItem key={main.id} id={main.id} name={main.name}>
                  {(handle) => (
                    <>
                      <CategoryRow
                        {...rowProps(main, tree, i)}
                        sub={false}
                        path={`/${main.slug}`}
                        handle={handle}
                        onAddSub={() => openNewSub(main.id)}
                      />
                      <SortableContext items={main.children.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                        <ul className="divide-y divide-border/60 border-t border-border/60 bg-muted/20">
                          {main.children.map((sub, j) => (
                            <SortableItem key={sub.id} id={sub.id} name={sub.name}>
                              {(subHandle) => (
                                <CategoryRow
                                  {...rowProps(sub, main.children, j)}
                                  sub
                                  path={`/${main.slug}/${sub.slug}`}
                                  handle={subHandle}
                                />
                              )}
                            </SortableItem>
                          ))}
                          <li>
                            <button
                              type="button"
                              onClick={() => openNewSub(main.id)}
                              className="flex h-10 w-full items-center gap-2 pl-9 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:bg-muted focus-visible:outline-none sm:pl-[4.5rem]"
                            >
                              <Plus className="size-4" aria-hidden />
                              Subcategoría en {main.name}
                            </button>
                          </li>
                        </ul>
                      </SortableContext>
                    </>
                  )}
                </SortableItem>
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        Arrastrá desde ⠿ (en el celular, con ↑ ↓) para cambiar el orden en que se muestran en la tienda. Las
        subcategorías se ordenan dentro de su categoría.
      </p>

      <CategoryDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        category={editing}
        categories={items}
        defaultParentId={newParentId}
      />
      <DeleteCategoryDialog category={deleting} categories={items} open={deleteOpen} onOpenChange={setDeleteOpen} />
    </>
  );
}

/** <li> que se puede arrastrar; le pasa la manija a su contenido. */
function SortableItem({
  id,
  name,
  children,
}: {
  id: string;
  name: string;
  children: (handle: DragHandle) => React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={isDragging ? "relative z-10" : undefined}
    >
      {children({
        button: (
          <DragHandleButton ref={setActivatorNodeRef} {...attributes} {...listeners} name={name} dragging={isDragging} />
        ),
        dragging: isDragging,
      })}
    </li>
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
  const siblings = (id: string | number) => {
    const parent = items.find((c) => c.id === id)?.parentId ?? null;
    return items.filter((c) => c.parentId === parent);
  };
  const position = (id: string | number) => siblings(id).findIndex((c) => c.id === id) + 1;
  return {
    onDragStart: ({ active }) => `Agarraste «${name(active.id)}».`,
    onDragOver: ({ active, over }) =>
      over ? `«${name(active.id)}» está en la posición ${position(over.id)} de ${siblings(active.id).length}.` : undefined,
    onDragEnd: ({ active, over }) =>
      over ? `Soltaste «${name(active.id)}» en la posición ${position(over.id)}.` : undefined,
    onDragCancel: ({ active }) => `Se canceló. «${name(active.id)}» quedó donde estaba.`,
  };
}
