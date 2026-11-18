import Image from "next/image";
import Link from "next/link";
import { cn } from "cn";
import { formatARS } from "@/lib/format";
import type { StoreProduct } from "@/lib/store-data";
import { productHref } from "@/lib/store-nav";

/**
 * Tarjeta de producto de la tienda (inicio, catálogo, categorías):
 * foto grande cuadrada, nombre y precio.
 *
 *   - Con descuento vigente: precio final en rojo y el anterior tachado.
 *   - Con variantes de distinto precio: "Desde $ …".
 *   - Sin stock: etiqueta "Sin stock" y la foto un poco apagada.
 *   - Borrador: etiqueta gris "Borrador" (solo les llegan a los admins).
 */
export function ProductCard({ product, priority }: { product: StoreProduct; priority?: boolean }) {
  const p = product;
  const discount = p.discountActive && p.finalPrice < p.price;

  return (
    <Link
      href={productHref(p.slug)}
      className="group flex flex-col gap-3 rounded-2xl outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
    >
      <div className="relative aspect-square overflow-hidden rounded-2xl bg-muted">
        {p.imageUrl ? (
          <Image
            src={p.imageUrl}
            alt={p.imageAlt || p.name}
            fill
            sizes="(min-width: 1152px) 270px, (min-width: 768px) 25vw, 50vw"
            preload={priority}
            className={cn(
              "object-cover transition-transform duration-500 group-hover:scale-[1.03]",
              !p.inStock && "opacity-60",
            )}
          />
        ) : (
          <NoPhoto />
        )}

        <div className="absolute top-2 left-2 flex flex-col items-start gap-1.5">
          {p.isDraft && (
            <span className="rounded-full bg-foreground/80 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur">
              Borrador
            </span>
          )}
          {discount && (
            <span className="rounded-full bg-brand px-2.5 py-1 text-xs font-semibold text-white">
              Oferta
            </span>
          )}
          {!p.inStock && (
            <span className="rounded-full bg-background/90 px-2.5 py-1 text-xs font-semibold text-foreground backdrop-blur">
              Sin stock
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1 px-0.5">
        <h3 className="line-clamp-2 text-[15px] leading-snug font-medium text-foreground group-hover:underline group-hover:underline-offset-4">
          {p.name}
        </h3>
        <p className="flex flex-wrap items-baseline gap-x-2 tabular-nums">
          {p.hasPriceRange && <span className="text-xs text-muted-foreground">Desde</span>}
          <span className={cn("text-base font-semibold", discount ? "text-brand" : "text-foreground")}>
            {formatARS(p.finalPrice)}
          </span>
          {discount && (
            <span className="text-sm text-muted-foreground line-through">
              <span className="sr-only">Antes: </span>
              {formatARS(p.price)}
            </span>
          )}
        </p>
      </div>
    </Link>
  );
}

/** Sin foto: el corazón de la marca, suave, para que la grilla no quede rota. */
function NoPhoto() {
  return (
    <div className="flex h-full items-center justify-center">
      <Image src="/brand/corazon.png" alt="" width={56} height={56} className="opacity-20 grayscale" />
    </div>
  );
}

/** Esqueleto de la grilla mientras cargan los productos. */
export function ProductGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-4 md:gap-x-6" aria-busy aria-label="Cargando productos">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex flex-col gap-3">
          <div className="aspect-square animate-pulse rounded-2xl bg-muted" />
          <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
          <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}
