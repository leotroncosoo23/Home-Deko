import Link from "next/link";
import { PackageSearch } from "lucide-react";
import type { PricingSettings } from "@/lib/pricing";
import type { StoreProduct } from "@/lib/store-data";
import { CATALOG_GRID, CATALOG_IMAGE_SIZES, ProductCard } from "./product-card";

/** Grilla del catálogo (columnas y separación en product-card.tsx, CATALOG_GRID). */
export function ProductGrid({ products, pricing }: { products: StoreProduct[]; pricing: PricingSettings }) {
  return (
    <ul className={CATALOG_GRID}>
      {products.map((p, i) => (
        <li key={p.id}>
          {/* Las primeras fotos se ven apenas abre la página: que carguen primero */}
          <ProductCard product={p} pricing={pricing} priority={i < 4} sizes={CATALOG_IMAGE_SIZES} />
        </li>
      ))}
    </ul>
  );
}

/**
 * Cuando no hay productos para mostrar (categoría vacía, búsqueda sin
 * resultados, filtros sin resultados), con un botón para seguir.
 */
export function NoProducts({
  title,
  text,
  action = { label: "Ver todos los productos", href: "/productos" },
}: {
  title: string;
  text: string;
  /** null = sin botón. */
  action?: { label: string; href: string } | null;
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
      {action && (
        <Link
          href={action.href}
          className="inline-flex h-11 items-center justify-center rounded-full border bg-background px-6 font-semibold transition-colors hover:bg-muted"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}
