"use server";

import { cookies } from "next/headers";
import { refresh } from "next/cache";
import { z } from "zod";
import { CART_MAX_ITEMS, CART_MAX_QTY, type CartData, type CartLine } from "@/lib/cart";
import { getPrices } from "@/lib/pricing";
import { getStoreSettings, pricingFrom } from "@/lib/store-settings";
import { publicImageUrl } from "@/lib/storage";
import { CUSTOMER_VIEW_COOKIE, CUSTOMER_VIEW_VALUE } from "@/lib/store-viewer";
import { createClient } from "@/lib/supabase/server";

/**
 * "Ver como cliente" (barra de admin de la tienda): guarda o borra la
 * cookie de preferencia y vuelve a pedir la página.
 *
 * No hace falta verificar el rol: la cookie solo puede OCULTAR cosas
 * (borradores y avisos para los dueños). Que un cliente vea un borrador lo
 * impide la base, con o sin esta cookie.
 */
export async function setCustomerView(on: boolean): Promise<void> {
  if (typeof on !== "boolean") return;
  const cookieStore = await cookies();

  if (on) {
    cookieStore.set(CUSTOMER_VIEW_COOKIE, CUSTOMER_VIEW_VALUE, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      // Sin maxAge: dura hasta cerrar el navegador (así no queda "pegada").
    });
  } else {
    cookieStore.delete(CUSTOMER_VIEW_COOKIE);
  }
  refresh();
}

// ---------------------------------------------------------------------------
// Carrito
// ---------------------------------------------------------------------------

const cartItemsSchema = z
  .array(z.object({ variantId: z.uuid(), qty: z.number().int().min(1).max(CART_MAX_QTY) }))
  .max(CART_MAX_ITEMS);

/**
 * Arma el carrito con los datos REALES del momento: nombre, foto, variante,
 * precio (de la vista store_variants, con el descuento vigente) y stock.
 *
 * Del navegador solo se usa qué variante y cuántas. Se consulta con la
 * sesión de quien mira: un visitante solo ve productos publicados y
 * visibles (RLS + store_products); un admin, también sus borradores.
 *
 * Por cada línea devuelve si está bien, si hubo que bajar la cantidad
 * (bajó el stock) o si ya no está disponible.
 */
export async function getCartLines(input: unknown): Promise<CartData> {
  const parsed = cartItemsSchema.safeParse(input);
  if (!parsed.success) throw new Error("El carrito no tiene un formato válido.");

  // Si la misma variante vino dos veces, se suman.
  const wanted = new Map<string, number>();
  for (const i of parsed.data) wanted.set(i.variantId, Math.min(CART_MAX_QTY, (wanted.get(i.variantId) ?? 0) + i.qty));
  const ids = [...wanted.keys()];

  const settingsPromise = getStoreSettings();
  if (ids.length === 0) {
    const s = await settingsPromise;
    return { lines: [], shippingCost: s.shippingCost, pricing: pricingFrom(s) };
  }

  const supabase = await createClient();
  const [variants, links] = await Promise.all([
    supabase.from("store_variants").select("variant_id, product_id, price, final_price, stock").in("variant_id", ids),
    supabase
      .from("variant_option_values")
      .select("variant_id, option_value_id, product_option_values(value, position, product_options(position))")
      .in("variant_id", ids),
  ]);
  if (variants.error || links.error) throw new Error("No se pudo leer el carrito.");

  const productIds = [...new Set(variants.data.flatMap((v) => (v.product_id ? [v.product_id] : [])))];
  const valueIds = links.data.map((l) => l.option_value_id);
  const [products, photos, settings] = await Promise.all([
    productIds.length
      ? supabase.from("store_products").select("id, name, slug, primary_image_path").in("id", productIds)
      : Promise.resolve({ data: [], error: null }),
    // Fotos de cada color: si elegiste "Rojo", el carrito muestra la foto roja.
    valueIds.length
      ? supabase
          .from("product_images")
          .select("storage_path, option_value_id")
          .in("option_value_id", valueIds)
          .order("is_primary", { ascending: false })
          .order("position")
      : Promise.resolve({ data: [], error: null }),
    settingsPromise,
  ]);
  if (products.error || photos.error) throw new Error("No se pudo leer el carrito.");

  const pricing = pricingFrom(settings);
  const variantById = new Map(variants.data.map((v) => [v.variant_id, v]));
  const productById = new Map(products.data.map((p) => [p.id, p]));
  const photoByValue = new Map<string, string>();
  for (const ph of photos.data) {
    if (ph.option_value_id && !photoByValue.has(ph.option_value_id)) photoByValue.set(ph.option_value_id, ph.storage_path);
  }

  // Texto de la variante, con las opciones en su orden ("Rojo / 30 cm").
  const valuesByVariant = new Map<string, { id: string; value: string; order: number }[]>();
  for (const l of links.data) {
    const v = l.product_option_values;
    if (!v) continue;
    const list = valuesByVariant.get(l.variant_id) ?? [];
    list.push({ id: l.option_value_id, value: v.value, order: (v.product_options?.position ?? 0) * 1000 + v.position });
    valuesByVariant.set(l.variant_id, list);
  }

  const lines: CartLine[] = ids.map((variantId) => {
    const requested = wanted.get(variantId) ?? 0;
    const v = variantById.get(variantId);
    const p = v?.product_id ? productById.get(v.product_id) : undefined;

    // Ya no se ve en la tienda: no sabemos ni cómo se llamaba.
    if (!v || !p) {
      return {
        variantId,
        status: "unavailable",
        qty: 0,
        name: null,
        slug: null,
        variantLabel: null,
        imageUrl: null,
        unitPrice: 0,
        listPrice: 0,
        offerPrice: 0,
        unitPriceBefore: null,
        maxQty: 0,
      };
    }

    const values = (valuesByVariant.get(variantId) ?? []).sort((a, b) => a.order - b.order);
    const colorPhoto = values.map((x) => photoByValue.get(x.id)).find(Boolean);
    const imagePath = colorPhoto ?? p.primary_image_path;
    const price = Number(v.price ?? 0);
    const finalPrice = Number(v.final_price ?? price);
    // Contado = lo que cobra create_order (misma regla: public.cash_price)
    const prices = getPrices({ price, finalPrice }, pricing);
    const stock = v.stock ?? 0;
    const qty = Math.min(requested, stock);

    return {
      variantId,
      status: stock <= 0 ? "unavailable" : qty < requested ? "adjusted" : "ok",
      qty,
      name: p.name,
      slug: p.slug,
      variantLabel: values.length ? values.map((x) => x.value).join(" / ") : null,
      imageUrl: imagePath ? publicImageUrl(imagePath) : null,
      unitPrice: prices.contado,
      listPrice: price,
      offerPrice: finalPrice,
      unitPriceBefore: prices.oferta ? prices.contadoSinOferta : null,
      maxQty: stock,
    };
  });

  return { lines, shippingCost: settings.shippingCost, pricing };
}
