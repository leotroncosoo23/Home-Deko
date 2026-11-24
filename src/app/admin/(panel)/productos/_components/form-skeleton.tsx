import { Skeleton } from "@/components/ui/skeleton";

/** Lo que se ve mientras carga el formulario. */
export function ProductFormSkeleton() {
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]" aria-busy aria-label="Cargando formulario">
      <div className="flex flex-col gap-6">
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-36 rounded-xl" />
        <Skeleton className="h-36 rounded-xl" />
      </div>
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}
