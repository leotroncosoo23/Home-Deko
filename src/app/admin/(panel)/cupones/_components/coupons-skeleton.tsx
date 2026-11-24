import { Skeleton } from "@/components/ui/skeleton";

/** Lo que se ve mientras cargan los cupones. */
export function CouponsSkeleton() {
  return (
    <div className="overflow-hidden surface-card" aria-busy aria-label="Cargando cupones">
      <div className="hidden h-8 border-b bg-muted/40 md:block" />
      <ul className="divide-y">
        {Array.from({ length: 3 }, (_, i) => (
          <li key={i} className="flex items-center gap-3 px-4 py-3.5">
            <div className="flex flex-1 flex-col gap-1.5">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-48" />
              <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className="hidden h-5 w-16 rounded-full md:block" />
            <Skeleton className="hidden h-4 w-12 md:block" />
            <Skeleton className="hidden h-4 w-20 md:block" />
            <Skeleton className="h-5 w-9 rounded-full" />
            <Skeleton className="size-8" />
          </li>
        ))}
      </ul>
    </div>
  );
}
