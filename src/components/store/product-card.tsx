import Image from "next/image";
import Link from "next/link";
import { cn } from "cn";
import { formatPrice } from "@/lib/format";
import { getPrices, type PricingSettings } from "@/lib/pricing";
import type { StoreProduct } from "@/lib/store-data";
import { productHref } from "@/lib/store-nav";
import { QuickAdd } from "./cart/quick-add";
import { CashTag, ListAndInstallments, showCashTag } from "./price-lines";

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
 * foto grande cuadrada, nombre (hasta 2 líneas), precio y botón rápido.
 *
 *   - Precio grande = CONTADO (1 pago, src/lib/pricing.ts) con la etiqueta
 *     "1 pago"; abajo, chico y gris, "Precio de lista" y las cuotas
 *     (ver price-lines.tsx: cada texto aparece solo si corresponde).
 *   - Con descuento vigente: etiqueta "-10% OFF" (o "Hasta -20% OFF"), precio
 *     contado en rojo y el contado sin oferta tachado.
 *   - Quedan 1 o 2 unidades en total: "¡Últimas unidades!" (nunca junto a "Sin stock").
 *   - Con variantes de distinto precio: "Desde $ …".
 *   - Sin stock: etiqueta "Sin stock", la foto un poco apagada y sin botón.
 *   - Con 2 fotos o más: la segunda aparece al pasar el mouse.
 *   - Borrador: etiqueta gris "Borrador" (solo les llegan a los admins).
 *   - Botón rápido debajo del precio, con texto en todos los tamaños:
 *     "Agregar" (una variante) o "Ver opciones" (varias).
 *   - Precios sin ",00" (formatPrice).
 *   - Al pasar el mouse: zoom leve de la foto y una sombra suave. En
 *     Tailwind v4, hover/group-hover solo aplican en dispositivos con
 *     mouse: en el celular nada queda "pegado" después de tocar.
 */
export function ProductCard({
  product,
  pricing,
  priority,
  sizes = CATALOG_IMAGE_SIZES,
}: {
  product: StoreProduct;
  /** % de 1 pago y cuotas (pricingFrom(getStoreSettings())). */
  pricing: PricingSettings;
  priority?: boolean;
  sizes?: string;
}) {
  const p = product;
  const prices = getPrices(p, pricing);
  const discount = p.discountActive && prices.oferta;
  const href = productHref(p.slug);
  // Botón rápido: sin stock no hay; con una variante "Agregar"; con varias "Ver opciones".
  const quick =
    p.inStock && p.variantCount > 0
      ? { variantId: p.variantCount === 1 ? p.singleVariantId : null, href, name: p.name, imageUrl: p.imageUrl }
      : null;

  return (
    // <article> y no un solo <Link>: el botón "Agregar" no puede ir dentro de un link.
    // data-product-card / data-card-image: desde esta foto vuela la miniatura al carrito.
    <article data-product-card className="group flex h-full flex-col gap-3">
      <Link
        href={href}
        className="flex flex-col gap-3 rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/30 focus-visible:ring-offset-4"
      >
        <div
          data-card-image
          className="relative aspect-square overflow-hidden rounded-xl bg-muted transition-shadow duration-300 group-hover:shadow-[0_12px_28px_-14px_rgb(43_43_43/0.35)]"
        >
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

          <div className="absolute top-2.5 left-2.5">
            <ProductBadges product={p} />
          </div>
        </div>

        {/* Hasta 2 líneas con "…". min-h de 2 líneas: así los precios de una
            misma fila quedan alineados aunque un nombre sea corto. */}
        <h3 className="line-clamp-2 min-h-[2lh] px-0.5 text-sm leading-snug text-foreground md:text-[15px]">
          {p.name}
        </h3>
      </Link>

      <div className="-mt-1.5 flex flex-1 flex-col gap-2.5 px-0.5 md:gap-3">
        <div className="flex flex-col gap-1">
          <p className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5 tabular-nums">
            {p.hasPriceRange && <span className="text-xs text-muted-foreground">Desde</span>}
            <span
              className={cn(
                "text-base font-bold tracking-tight md:text-lg",
                discount ? "text-brand" : "text-foreground",
              )}
            >
              {formatPrice(prices.contado)}
            </span>
            {showCashTag(pricing) && <CashTag className="self-center" />}
            {discount && (
              <span className="text-sm text-muted-foreground line-through">
                <span className="sr-only">Antes: </span>
                {formatPrice(prices.contadoSinOferta)}
              </span>
            )}
          </p>
          <ListAndInstallments prices={prices} pricing={pricing} />
        </div>
        {/* mt-auto: en una misma fila, los botones quedan alineados abajo */}
        {quick && (
          <div className="mt-auto">
            <QuickAdd {...quick} />
          </div>
        )}
      </div>
    </article>
  );
}

/**
 * Etiquetas sobre la foto: "Borrador", "-10% OFF", "Sin stock" o "¡Últimas
 * unidades!". Las comparten la tarjeta y la página del producto.
 */
export function ProductBadges({ product: p }: { product: StoreProduct }) {
  const discount = p.discountActive && p.finalPrice < p.price;
  return (
    <div className="flex flex-col items-start gap-1.5">
      {p.isDraft && (
        <span className="rounded-full bg-foreground/80 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur">
          Borrador
        </span>
      )}
      {discount && (
        <span className="rounded-full bg-brand px-3 py-1 text-[13px] font-bold tracking-tight text-white shadow-sm tabular-nums md:text-sm">
          {discountLabel(p)}
        </span>
      )}
      {!p.inStock ? (
        <span className="rounded-full bg-background/90 px-2.5 py-1 text-xs font-semibold text-foreground backdrop-blur">
          Sin stock
        </span>
      ) : (
        p.fewLeft && (
          // En una línea siempre (en las tiras del inicio la tarjeta es más angosta y se partía sobre la foto).
          <span className="rounded-full bg-background/90 px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap text-brand backdrop-blur md:text-xs">
            ¡Últimas unidades!
          </span>
        )
      )}
    </div>
  );
}

/**
 * Etiqueta del descuento: "-10% OFF", o "Hasta -20% OFF" si las variantes
 * ahorran distinto (descuento de monto fijo con precios distintos). Si el
 * porcentaje redondea a 0, queda "Oferta".
 */
export function discountLabel(p: StoreProduct): string {
  if (p.discountPercent === null || p.discountPercent <= 0) return "Oferta";
  return `${p.discountPercentVaries ? "Hasta " : ""}${percentOffLabel(p.discountPercent)}`;
}

/** 15 → "-15% OFF". */
export function percentOffLabel(percent: number): string {
  return `-${percent}% OFF`;
}

/** Sin foto: el corazón de la marca, suave, para que la grilla no quede rota. */
export function NoPhoto() {
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
