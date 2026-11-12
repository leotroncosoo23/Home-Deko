import { LayoutGrid } from "lucide-react";
import { NewCategoryButton } from "./new-category-button";

/** Lo que se ve cuando todavía no hay ninguna categoría. */
export function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed bg-background px-6 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-brand-soft">
        <LayoutGrid className="size-5 text-brand" aria-hidden />
      </div>
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold">Creá tu primera categoría</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          Las categorías ordenan los productos en la tienda, por ejemplo: Cocina, Baño o
          Decoración. Después podés cambiarles el orden arrastrándolas.
        </p>
      </div>
      <NewCategoryButton size="lg" />
    </div>
  );
}
