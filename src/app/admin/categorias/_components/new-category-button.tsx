"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CategoryDialog } from "./category-dialog";

/**
 * Botón "Nueva categoría" + su diálogo. Es independiente del listado, así
 * se puede mostrar en el encabezado (que carga al instante) y en el
 * estado vacío.
 */
export function NewCategoryButton({ size = "default" }: { size?: "default" | "lg" }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size={size} onClick={() => setOpen(true)}>
        <Plus /> Nueva categoría
      </Button>
      <CategoryDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
