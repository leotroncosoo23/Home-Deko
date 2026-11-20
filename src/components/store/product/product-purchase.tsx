"use client";

import { useState } from "react";
import { Check, Minus, Plus } from "lucide-react";
import type { ProductOption, ProductPhoto, ProductVariant, StoreProduct } from "@/lib/store-data";
import { formatARS } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useCart } from "../cart/cart-provider";
import { useAddedFlash } from "../cart/use-added-flash";
import { discountLabel, ProductBadges } from "../product-card";
import { ProductGallery } from "./product-gallery";

/** Lo elegido: id de la opción → id del valor ("Color" → "Rojo"). */
type Selection = Record<string, string>;

/**
 * Parte interactiva de la página de producto: galería + compra.
 *
 *   [ galería ]  [ nombre, precio, opciones, cantidad, "Agregar al carrito" ]
 *                [ children: envío, WhatsApp y descripción (del servidor)   ]
 *
 * Opciones: se eligen en orden (primero Color, después Medida…). Un valor
 * sin stock con lo ya elegido se ve tachado y no se puede tocar. Al cambiar
 * una opción, las siguientes pasan a la primera que tenga stock.
 */
export function ProductPurchase({
  product,
  options,
  variants,
  photos,
  children,
}: {
  product: StoreProduct;
  options: ProductOption[];
  variants: ProductVariant[];
  photos: ProductPhoto[];
  children: React.ReactNode;
}) {
  const { add, qtyInCart } = useCart();
  const [selection, setSelection] = useState<Selection>(() => initialSelection(options, variants));
  const [qty, setQty] = useState(1);
  const [added, flash] = useAddedFlash();

  const variant =
    options.length === 0
      ? variants[0]
      : variants.find((v) => options.every((o) => selection[o.id] && v.optionValueIds.includes(selection[o.id])));

  // Fotos: primero las del valor elegido (por ejemplo, las del color rojo).
  const chosen = new Set(Object.values(selection));
  const ordered = [
    ...photos.filter((p) => p.optionValueId && chosen.has(p.optionValueId)),
    ...photos.filter((p) => !p.optionValueId || !chosen.has(p.optionValueId)),
  ];
  // La galería vuelve a la primera foto solo si cambió un valor que tiene fotos.
  const galleryKey = photos
    .flatMap((p) => (p.optionValueId && chosen.has(p.optionValueId) ? [p.optionValueId] : []))
    .filter((id, i, all) => all.indexOf(id) === i)
    .join(",");

  // Cantidad: como máximo lo que queda sin contar lo que ya está en el carrito.
  const inCart = variant ? qtyInCart(variant.id) : 0;
  const left = variant ? Math.max(0, variant.stock - inCart) : 0;
  const amount = Math.max(1, Math.min(qty, left));

  function select(index: number, valueId: string) {
    const next: Selection = { ...selection, [options[index].id]: valueId };
    // Las opciones siguientes: si lo elegido ya no tiene stock, la primera que sí.
    for (let j = index + 1; j < options.length; j++) {
      const o = options[j];
      if (next[o.id] && isAvailable(options, variants, next, j, next[o.id])) continue;
      const first = o.values.find((v) => isAvailable(options, variants, next, j, v.id));
      if (first) next[o.id] = first.id;
      else delete next[o.id];
    }
    setSelection(next);
    setQty(1);
  }

  function handleAdd() {
    if (!variant || left <= 0) return;
    const source = Array.from(document.querySelectorAll<HTMLElement>("[data-gallery-main]")).find(
      (el) => el.getBoundingClientRect().width > 0,
    );
    add({
      variantId: variant.id,
      qty: amount,
      max: variant.stock,
      name: product.name,
      imageUrl: ordered[0]?.url ?? null,
      source,
    });
    flash();
    setQty(1);
  }

  // --- Precio a mostrar: el de la variante elegida, o "Desde" ---
  const price = variant ? variant.price : product.price;
  const finalPrice = variant ? variant.finalPrice : product.finalPrice;
  const hasDiscount = finalPrice < price;
  const percent = variant && hasDiscount ? Math.round((100 * (price - finalPrice)) / price) : null;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-start lg:gap-12 xl:gap-16">
      <ProductGallery key={galleryKey} photos={ordered} name={product.name} badges={<ProductBadges product={product} />} />

      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-3">
          <h1 className="font-display text-[26px] leading-tight font-semibold tracking-tight md:text-3xl lg:text-[34px]">
            {product.name}
          </h1>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 tabular-nums">
            {!variant && product.hasPriceRange && <span className="text-sm text-muted-foreground">Desde</span>}
            <span className={cn("text-2xl font-semibold tracking-tight md:text-[28px]", hasDiscount && "text-brand")}>
              {formatARS(finalPrice)}
            </span>
            {hasDiscount && (
              <>
                <span className="text-base text-muted-foreground line-through">
                  <span className="sr-only">Antes: </span>
                  {formatARS(price)}
                </span>
                <span className="rounded-full bg-brand px-2.5 py-1 text-xs font-semibold text-white">
                  {percent !== null && percent > 0 ? `-${percent}%` : discountLabel(product)}
                </span>
              </>
            )}
          </div>
          {product.inStock && product.fewLeft && (
            <p className="text-sm font-semibold text-brand">¡Últimas unidades!</p>
          )}
        </div>

        {options.map((o, i) => (
          <OptionPicker
            key={o.id}
            option={o}
            selected={selection[o.id]}
            isAvailable={(valueId) => isAvailable(options, variants, selection, i, valueId)}
            onSelect={(valueId) => select(i, valueId)}
          />
        ))}

        <div className="flex flex-col gap-2">
          <div className="flex gap-3">
            {product.inStock && (
              <div className="inline-flex h-12 shrink-0 items-center rounded-full border" role="group" aria-label="Cantidad">
                <button
                  type="button"
                  onClick={() => setQty(amount - 1)}
                  disabled={amount <= 1 || left <= 0}
                  aria-label="Restar una unidad"
                  className="inline-flex size-12 items-center justify-center rounded-full transition-colors hover:bg-muted disabled:opacity-35 disabled:hover:bg-transparent"
                >
                  <Minus aria-hidden className="size-4" />
                </button>
                <output aria-live="polite" className="min-w-8 text-center font-semibold tabular-nums">
                  {left > 0 ? amount : 0}
                </output>
                <button
                  type="button"
                  onClick={() => setQty(amount + 1)}
                  disabled={amount >= left}
                  aria-label="Sumar una unidad"
                  className="inline-flex size-12 items-center justify-center rounded-full transition-colors hover:bg-muted disabled:opacity-35 disabled:hover:bg-transparent"
                >
                  <Plus aria-hidden className="size-4" />
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={handleAdd}
              disabled={!variant || left <= 0}
              className={cn(
                "inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full px-6 text-[15px] font-semibold text-white transition-colors focus-visible:ring-3 focus-visible:ring-brand/30 focus-visible:outline-none",
                "bg-brand hover:bg-brand-hover disabled:bg-muted disabled:text-muted-foreground",
              )}
            >
              {added ? (
                <>
                  Agregado <Check aria-hidden className="size-4" strokeWidth={3} />
                </>
              ) : !product.inStock ? (
                "Sin stock"
              ) : !variant ? (
                "Elegí una opción"
              ) : left <= 0 && variant.stock > 0 ? (
                "Ya está en tu carrito"
              ) : left <= 0 ? (
                "Sin stock"
              ) : (
                "Agregar al carrito"
              )}
            </button>
          </div>
          {variant && left <= 0 && variant.stock > 0 && !added && (
            <p className="text-sm text-muted-foreground">Ya tenés en el carrito todas las unidades disponibles.</p>
          )}
          {!product.inStock && (
            <p className="text-sm text-muted-foreground">
              Por ahora no nos quedan unidades. Escribinos por WhatsApp y te avisamos cuando vuelva.
            </p>
          )}
        </div>

        {children}
      </div>
    </div>
  );
}

/** Al abrir: la primera combinación con stock (o nada, si no hay stock). */
function initialSelection(options: ProductOption[], variants: ProductVariant[]): Selection {
  const first = variants.find((v) => v.stock > 0);
  if (!first) return {};
  const sel: Selection = {};
  for (const o of options) {
    const value = o.values.find((v) => first.optionValueIds.includes(v.id));
    if (value) sel[o.id] = value.id;
  }
  return sel;
}

/**
 * ¿Se puede elegir este valor? Sí, si hay alguna variante con stock que lo
 * tenga y que coincida con lo elegido en las opciones ANTERIORES.
 */
function isAvailable(
  options: ProductOption[],
  variants: ProductVariant[],
  sel: Selection,
  index: number,
  valueId: string,
): boolean {
  const before = options.slice(0, index).flatMap((o) => (sel[o.id] ? [sel[o.id]] : []));
  return variants.some(
    (v) => v.stock > 0 && v.optionValueIds.includes(valueId) && before.every((id) => v.optionValueIds.includes(id)),
  );
}

function OptionPicker({
  option,
  selected,
  isAvailable,
  onSelect,
}: {
  option: ProductOption;
  selected: string | undefined;
  isAvailable: (valueId: string) => boolean;
  onSelect: (valueId: string) => void;
}) {
  const current = option.values.find((v) => v.id === selected);
  return (
    <fieldset className="flex flex-col gap-2.5">
      <legend className="mb-2.5 text-sm">
        <span className="font-semibold">{option.name}:</span>{" "}
        <span className="text-muted-foreground">{current?.value ?? "elegí una opción"}</span>
      </legend>
      <div className="flex flex-wrap gap-2">
        {option.values.map((v) => {
          const available = isAvailable(v.id);
          const active = v.id === selected;
          return (
            <button
              key={v.id}
              type="button"
              onClick={() => onSelect(v.id)}
              disabled={!available}
              aria-pressed={active}
              aria-label={available ? v.value : `${v.value}, sin stock`}
              className={cn(
                "inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm transition-colors focus-visible:ring-3 focus-visible:ring-ring/30 focus-visible:outline-none",
                active ? "border-foreground font-semibold ring-1 ring-foreground" : "hover:border-foreground/60",
                !available && "cursor-not-allowed border-dashed text-muted-foreground line-through opacity-60 hover:border-border",
              )}
            >
              {v.colorHex && (
                <span
                  aria-hidden
                  className="size-4 shrink-0 rounded-full ring-1 ring-black/10"
                  style={{ backgroundColor: v.colorHex }}
                />
              )}
              {v.value}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
