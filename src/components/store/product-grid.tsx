import Link from "next/link";
import { PackageSearch } from "lucide-react";
import type { StoreProduct } from "@/lib/store-data";
import { ProductCard } from "./product-card";

/** Grilla de productos: 2 columnas en el celular, 3 en tablet y 4 en PC. */
export function ProductGrid({ products }: { products: StoreProduct[] }) {
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 md:gap-x-6 lg:grid-cols-4">
      {products.map((p, i) => (
        <li key={p.id}>
          {/* Las primeras fotos se ven apenas abre la página: que carguen primero */}
          <ProductCard product={p} priority={i < 4} />
        </li>
      ))}
    </ul>
  );
}

/** Cuando no hay productos para mostrar (búsqueda sin resultados, categoría vacía). */
export function NoProducts({
  title,
  text,
  showAllLink = true,
}: {
  title: string;
  text: string;
  /** false en /productos sin búsqueda (ya estás en "todos los productos"). */
  showAllLink?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-3xl bg-muted/60 px-6 py-14 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-background text-brand">
        <PackageSearch aria-hidden className="size-6" />
      </span>
      <div className="flex flex-col gap-1">
        <p className="text-lg font-semibold">{title}</p>
        <p className="max-w-sm text-[15px] text-muted-foreground">{text}</p>
      </div>
      {showAllLink && (
        <Link
          href="/productos"
          className="inline-flex h-11 items-center justify-center rounded-full border bg-background px-6 font-semibold transition-colors hover:bg-muted"
        >
          Ver todos los productos
        </Link>
      )}
    </div>
  );
}
