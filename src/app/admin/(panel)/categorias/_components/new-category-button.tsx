"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Category } from "../types";
import { CategoryDialog } from "./category-dialog";

/**
 * Botón "Nueva categoría" + su diálogo. Es independiente del listado, así
 * se puede mostrar en el encabezado y en el estado vacío. Recibe las
 * categorías para el campo "Pertenece a".
 */
export function NewCategoryButton({
  size = "default",
  categories,
  disabled = false,
}: {
  size?: "default" | "lg";
  categories: Category[];
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size={size} onClick={() => setOpen(true)} disabled={disabled}>
        <Plus /> Nueva categoría
      </Button>
      <CategoryDialog open={open} onOpenChange={setOpen} categories={categories} />
    </>
  );
}
