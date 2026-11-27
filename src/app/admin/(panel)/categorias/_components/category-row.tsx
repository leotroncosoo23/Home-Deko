"use client";

import Image from "next/image";
import {
  ArrowDown,
  ArrowUp,
  CornerDownRight,
  Eye,
  EyeOff,
  GripVertical,
  ImageIcon,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Category } from "../types";

/** Columnas de la fila (y del encabezado del listado). */
export const ROW_GRID =
  "grid grid-cols-[auto_1fr_auto] items-center gap-2 sm:grid-cols-[auto_auto_1fr_7rem_6rem_auto] sm:gap-3";

/** La manija ⠿ ya armada (la arma SortableItem con useSortable) y si se está arrastrando. */
export type DragHandle = { button: React.ReactNode; dragging: boolean };

/** Manija para arrastrar (PC y tablet). En el celular no está: se ordena con ↑ ↓. */
export function DragHandleButton({
  name,
  dragging,
  ...props
}: React.ComponentProps<"button"> & { name: string; dragging: boolean }) {
  return (
    <button
      type="button"
      {...props}
      aria-label={`Mover «${name}». Arrastrá, o usá espacio y las flechas.`}
      className={cn(
        "hidden h-9 w-7 touch-none items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/40 sm:flex",
        dragging ? "cursor-grabbing" : "cursor-grab",
      )}
    >
      <GripVertical className="size-4" aria-hidden />
    </button>
  );
}

/**
 * Una fila del árbol: principal (con foto) o subcategoría (indentada, más
 * liviana). En PC se arrastra SOLO desde la manija (⠿), así en el celular
 * se puede seguir haciendo scroll; en el celular, botones ↑ ↓.
 */
export function CategoryRow({
  category,
  sub,
  path,
  handle,
  canMoveUp,
  canMoveDown,
  onMove,
  onEdit,
  onAddSub,
  onToggleVisibility,
  onDelete,
}: {
  category: Category;
  /** Es una subcategoría (va indentada). */
  sub: boolean;
  /** Dirección en la tienda: /cocina o /cocina/utensilios. */
  path: string;
  handle: DragHandle;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMove: (direction: -1 | 1) => void;
  onEdit: () => void;
  /** Solo principales: "+ Subcategoría". */
  onAddSub?: () => void;
  onToggleVisibility: () => void;
  onDelete: () => void;
}) {
  const productsText = category.productCount === 1 ? "1 producto" : `${category.productCount} productos`;
  const kind = sub ? "subcategoría" : "categoría";

  return (
    <div
      className={cn(
        ROW_GRID,
        "bg-background py-2.5 pr-2 sm:pr-3",
        sub ? "pl-7 sm:pl-10" : "pl-2 sm:pl-3",
        handle.dragging && "relative z-10 rounded-lg shadow-lg ring-1 ring-foreground/10",
      )}
    >
      {handle.button}

      {/* Miniatura (principal) o flecha (subcategoría) */}
      {sub ? (
        <div className="flex size-8 items-center justify-center text-muted-foreground/70">
          <CornerDownRight className="size-4" aria-hidden />
        </div>
      ) : (
        <div className="relative flex size-10 items-center justify-center overflow-hidden rounded-md border bg-muted">
          {category.imageUrl ? (
            <Image src={category.imageUrl} alt="" fill sizes="40px" className="object-cover" />
          ) : (
            <ImageIcon className="size-4 text-muted-foreground/60" aria-hidden />
          )}
        </div>
      )}

      {/* Nombre y slug (en el celular, también los productos y el estado) */}
      <div className="flex min-w-0 flex-col gap-0.5">
        <button
          type="button"
          onClick={onEdit}
          className={cn(
            "truncate text-left hover:underline focus-visible:underline focus-visible:outline-none",
            sub ? "text-[15px]" : "font-semibold",
          )}
        >
          {category.name}
        </button>
        <span className="truncate text-xs text-muted-foreground">{path}</span>
        <span className="flex items-center gap-2 text-xs text-muted-foreground sm:hidden">
          <span className="tabular-nums">{productsText}</span>
          <VisibilityBadge visible={category.isVisible} />
        </span>
      </div>

      {/* Productos (desde tablet) */}
      <span className="hidden text-sm text-muted-foreground tabular-nums sm:block">{productsText}</span>

      {/* Estado (desde tablet) */}
      <span className="hidden sm:block">
        <VisibilityBadge visible={category.isVisible} />
      </span>

      <div className="flex items-center">
        {/* ↑ ↓ en el celular (alternativa a arrastrar) */}
        <span className="flex sm:hidden">
          <Button
            variant="ghost"
            size="icon"
            disabled={!canMoveUp}
            onClick={() => onMove(-1)}
            aria-label={`Subir «${category.name}»`}
          >
            <ArrowUp />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            disabled={!canMoveDown}
            onClick={() => onMove(1)}
            aria-label={`Bajar «${category.name}»`}
          >
            <ArrowDown />
          </Button>
        </span>

        {/* Menú ⋯ */}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="ghost" size="icon" aria-label={`Acciones de «${category.name}»`} />}
          >
            <MoreHorizontal />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={onEdit}>
              <Pencil /> Editar
            </DropdownMenuItem>
            {onAddSub && (
              <DropdownMenuItem onClick={onAddSub}>
                <Plus /> Subcategoría
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={onToggleVisibility}>
              {category.isVisible ? <EyeOff /> : <Eye />}
              {category.isVisible ? "Ocultar" : "Mostrar"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={onDelete}>
              <Trash2 /> Eliminar {kind}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

/** Verde "Visible" / gris "Oculta" (colores de estado del CLAUDE.md). */
function VisibilityBadge({ visible }: { visible: boolean }) {
  return visible ? (
    <Badge className="bg-emerald-50 text-emerald-700">Visible</Badge>
  ) : (
    <Badge variant="secondary" className="text-muted-foreground">
      Oculta
    </Badge>
  );
}
