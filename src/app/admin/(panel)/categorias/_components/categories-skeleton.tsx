import { Skeleton } from "@/components/ui/skeleton";

/** Lo que se ve mientras cargan las categorías (filas grises). */
export function CategoriesSkeleton() {
  return (
    <div className="overflow-hidden surface-card" aria-busy aria-label="Cargando categorías">
      <div className="hidden h-8 border-b bg-muted/40 sm:block" />
      <ul className="divide-y">
        {Array.from({ length: 4 }, (_, i) => (
          <li key={i} className="flex items-center gap-3 px-3 py-3">
            <Skeleton className="h-6 w-4" />
            <Skeleton className="size-10 rounded-md" />
            <div className="flex flex-1 flex-col gap-1.5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="hidden h-4 w-20 sm:block" />
            <Skeleton className="hidden h-5 w-14 rounded-full sm:block" />
            <Skeleton className="size-8" />
          </li>
        ))}
      </ul>
    </div>
  );
}
