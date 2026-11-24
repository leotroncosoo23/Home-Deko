"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { useProductsListUrl } from "./list-url";

/** "← Productos": vuelve al listado con los filtros que tenía. */
export function BackToProducts() {
  const href = useProductsListUrl();
  return (
    <Link
      href={href}
      className="-ml-1 flex w-fit items-center gap-0.5 rounded-md px-1 text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
    >
      <ChevronLeft className="size-4" aria-hidden /> Productos
    </Link>
  );
}
