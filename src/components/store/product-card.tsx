import Image from "next/image";
import Link from "next/link";
import { cn } from "cn";
import { formatARS } from "@/lib/format";
import type { StoreProduct } from "@/lib/store-data";
import { productHref } from "@/lib/store-nav";

// ---------------------------------------------------------------------------
// Grillas (las comparten el catálogo, el inicio y los esqueletos de carga)
//
//   catálogo: 2 columnas (celular) · 3 (tablet y notebook chica, ya con la
//             columna de filtros) · 4 desde 1280 px
//   inicio:   2 columnas (celular) · 4 desde tablet (8 destacados = 2 filas justas)
// ---------------------------------------------------------------------------
export const CATALOG_GRID =
  "grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 md:gap-x-6 md:gap-y-10 xl:grid-cols-4 xl:gap-x-8 xl:gap-y-12";
export const HOME_GRID = "grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-4 md:gap-x-6 md:gap-y-10 xl:gap-x-8";

/** Ancho real de cada foto según la pantalla (así next/image baja el tamaño justo). */
export const CATALOG_IMAGE_SIZES = "(min-width: 1440px) 270px, (min-width: 1280px) 21vw, (min-width: 768px) 30vw, 50vw";
export const HOME_IMAGE_SIZES = "(min-width: 1440px) 320px, (min-width: 768px) 24vw, 50vw";

/**
 * Tarjeta de producto de la tienda (inicio, catálogo, categorías, búsqueda):
 * foto grande cuadrada, nombre (hasta 2 líneas) y precio.
 *
 *   - Con descuento vigente: etiqueta "-10%" (o "Hasta -20%"), precio final
 *     en rojo y el anterior tachado.
 *   - Quedan 1 a 3 unidades: "¡Últimas unidades!" (nunca junto a "Sin stock").
 *   - Con variantes de distinto precio: "Desde $ …".
 *   - Sin stock: etiqueta "Sin stock" y la foto un poco apagada.
 *   - Con 2 fotos o más: la segunda aparece al pasar el mouse.
 *   - Borrador: etiqueta gris "Borrador" (solo les llegan a los admins).
 *   - Al pasar el mouse: zoom leve de la foto y una sombra suave. En
 *     Tailwind v4, hover/group-hover solo aplican en dispositivos con
 *     mouse: en el celular nada queda "pegado" después de tocar.
 */
export function ProductCard({
  product,
  priority,
  sizes = CATALOG_IMAGE_SIZES,
}: {
  product: StoreProduct;
  priority?: boolean;
  sizes?: string;
}) {
  const p = product;
  const discount = p.discountActive && p.finalPrice < p.price;

  return (
    <Link
      href={productHref(p.slug)}
      className="group flex flex-col gap-3 rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/30 focus-visible:ring-offset-4"
    >
      <div className="relative aspect-square overflow-hidden rounded-xl bg-muted transition-shadow duration-300 group-hover:shadow-[0_12px_28px_-14px_rgb(43_43_43/0.35)]">
        {p.imageUrl ? (
          <Image
            src={p.imageUrl}
            alt={p.imageAlt || p.name}
            fill
            sizes={sizes}
            preload={priority}
            className={cn(
              "object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]",
              !p.inStock && "opacity-60",
            )}
          />
        ) : (
          <NoPhoto />
        )}

        {/* Segunda foto: aparece con un fundido al pasar el mouse. Carga diferida (lazy). */}
        {p.imageUrl && p.secondaryImageUrl && (
          <Image
            src={p.secondaryImageUrl}
            alt=""
            fill
            sizes={sizes}
            className={cn(
              "object-cover opacity-0 transition-[opacity,transform] duration-500 ease-out group-hover:scale-[1.04] group-hover:opacity-100",
              !p.inStock && "group-hover:opacity-60",
            )}
          />
        )}

        <div className="absolute top-2.5 left-2.5 flex flex-col items-start gap-1.5">
          {p.isDraft && (
            <span className="rounded-full bg-foreground/80 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur">
              Borrador
            </span>
          )}
          {discount && (
            <span className="rounded-full bg-brand px-2.5 py-1 text-xs font-semibold text-white tabular-nums">
              {discountLabel(p)}
            </span>
          )}
          {!p.inStock ? (
            <span className="rounded-full bg-background/90 px-2.5 py-1 text-xs font-semibold text-foreground backdrop-blur">
              Sin stock
            </span>
          ) : (
            p.fewLeft && (
              <span className="rounded-full bg-background/90 px-2.5 py-1 text-xs font-semibold text-brand backdrop-blur">
                ¡Últimas unidades!
              </span>
            )
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1.5 px-0.5">
        {/* Hasta 2 líneas con "…". min-h de 2 líneas: así los precios de una
            misma fila quedan alineados aunque un nombre sea corto. */}
        <h3 className="line-clamp-2 min-h-[2lh] text-sm leading-snug text-foreground md:text-[15px]">
          {p.name}
        </h3>
        <p className="flex flex-wrap items-baseline gap-x-2 tabular-nums">
          {p.hasPriceRange && <span className="text-xs text-muted-foreground">Desde</span>}
          <span
            className={cn(
              "text-base font-semibold tracking-tight md:text-[17px]",
              discount ? "text-brand" : "text-foreground",
            )}
          >
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

/**
 * Etiqueta del descuento: "-10%", o "Hasta -20%" si las variantes ahorran
 * distinto (descuento de monto fijo con precios distintos). Si el
 * porcentaje redondea a 0, queda "Oferta".
 */
function discountLabel(p: StoreProduct): string {
  if (p.discountPercent === null) return "Oferta";
  return `${p.discountPercentVaries ? "Hasta " : ""}-${p.discountPercent}%`;
}

/** Sin foto: el corazón de la marca, suave, para que la grilla no quede rota. */
function NoPhoto() {
  return (
    <div className="flex h-full items-center justify-center">
      <Image src="/brand/corazon.png" alt="" width={56} height={56} className="opacity-20 grayscale" />
    </div>
  );
}

/** Esqueleto de la grilla mientras cargan los productos (misma grilla que el resultado). */
export function ProductGridSkeleton({
  count = 4,
  variant = "home",
}: {
  count?: number;
  variant?: "catalog" | "home";
}) {
  return (
    <div className={variant === "catalog" ? CATALOG_GRID : HOME_GRID} aria-busy aria-label="Cargando productos">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex flex-col gap-3">
          <div className="aspect-square animate-pulse rounded-xl bg-muted" />
          <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
          <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}
