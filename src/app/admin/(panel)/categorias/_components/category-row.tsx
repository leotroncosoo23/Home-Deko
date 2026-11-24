"use client";

import Image from "next/image";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Eye, EyeOff, GripVertical, ImageIcon, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
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

/**
 * Una fila del listado. Se arrastra SOLO desde la manija (⠿), así en el
 * celular se puede seguir haciendo scroll tocando el resto de la fila.
 */
export function CategoryRow({
  category,
  onEdit,
  onToggleVisibility,
  onDelete,
}: {
  category: Category;
  onEdit: () => void;
  onToggleVisibility: () => void;
  onDelete: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: category.id });

  const productsText =
    category.productCount === 1 ? "1 producto" : `${category.productCount} productos`;

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "relative grid grid-cols-[auto_auto_1fr_auto] items-center gap-3 bg-background px-2 py-2.5 sm:grid-cols-[auto_auto_1fr_7rem_6rem_auto] sm:px-3",
        // Mientras se arrastra: queda por encima, con sombra.
        isDragging && "z-10 rounded-lg shadow-lg ring-1 ring-foreground/10",
      )}
    >
      {/* Manija para arrastrar */}
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={`Mover «${category.name}». Arrastrá, o usá espacio y las flechas.`}
        className={cn(
          "flex h-9 w-7 touch-none items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/40",
          isDragging ? "cursor-grabbing" : "cursor-grab",
        )}
      >
        <GripVertical className="size-4" aria-hidden />
      </button>

      {/* Miniatura */}
      <div className="relative flex size-10 items-center justify-center overflow-hidden rounded-md border bg-muted">
        {category.imageUrl ? (
          <Image src={category.imageUrl} alt="" fill sizes="40px" className="object-cover" />
        ) : (
          <ImageIcon className="size-4 text-muted-foreground/60" aria-hidden />
        )}
      </div>

      {/* Nombre y slug (en el celular, también los productos y el estado) */}
      <div className="flex min-w-0 flex-col gap-0.5">
        <button
          type="button"
          onClick={onEdit}
          className="truncate text-left font-medium hover:underline focus-visible:underline focus-visible:outline-none"
        >
          {category.name}
        </button>
        <span className="truncate text-xs text-muted-foreground">/{category.slug}</span>
        <span className="flex items-center gap-2 text-xs text-muted-foreground sm:hidden">
          <span className="tabular-nums">{productsText}</span>
          <VisibilityBadge visible={category.isVisible} />
        </span>
      </div>

      {/* Productos (desde tablet) */}
      <span className="hidden text-sm tabular-nums text-muted-foreground sm:block">
        {productsText}
      </span>

      {/* Estado (desde tablet) */}
      <span className="hidden sm:block">
        <VisibilityBadge visible={category.isVisible} />
      </span>

      {/* Menú ⋯ */}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="icon" aria-label={`Acciones de «${category.name}»`} />}
        >
          <MoreHorizontal />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onClick={onEdit}>
            <Pencil /> Editar
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onToggleVisibility}>
            {category.isVisible ? <EyeOff /> : <Eye />}
            {category.isVisible ? "Ocultar" : "Mostrar"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={onDelete}>
            <Trash2 /> Eliminar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
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
