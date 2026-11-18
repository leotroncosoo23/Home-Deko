import Link from "next/link";
import { ChevronLeft } from "lucide-react";

/** "← Apariencia de la tienda": vuelve a la sección. */
export function BackToBanners() {
  return (
    <Link
      href="/admin/apariencia"
      className="-ml-1 flex w-fit items-center gap-0.5 rounded-md px-1 text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
    >
      <ChevronLeft className="size-4" aria-hidden /> Apariencia de la tienda
    </Link>
  );
}
