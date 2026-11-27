import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Store, Truck } from "lucide-react";
import { Breadcrumbs, type Crumb } from "@/components/store/catalog/breadcrumbs";
import { HOME_GRID, HOME_IMAGE_SIZES, ProductCard } from "@/components/store/product-card";
import { ProductPurchase } from "@/components/store/product/product-purchase";
import { formatPrice } from "@/lib/format";
import { getPrices, type PricingSettings } from "@/lib/pricing";
import { siteUrl } from "@/lib/site-url";
import {
  getPublishedProduct,
  getPublishedProductSlugs,
  getRelatedProducts,
  type ProductDetail,
} from "@/lib/store-data";
import { STORE_CONTAINER } from "@/lib/store-layout";
import { ALL_PRODUCTS_LINK, categoryHref, productHref } from "@/lib/store-nav";
import { WhatsAppIcon } from "@/components/store/whatsapp-icon";
import { ProductViewTracker } from "@/components/store/visit-tracker";
import { getStoreSettings, pricingFrom, whatsappLink, type StoreSettings } from "@/lib/store-settings";
import { getProductForViewer } from "@/lib/store-viewer";
import { cn } from "@/lib/utils";

/**
 * /productos/[slug] — la página de un producto.
 *
 * Qué se ve:
 *   - Publicado (y con su categoría visible) → todos.
 *   - Borrador → solo los admins (con la etiqueta "Borrador").
 *   - Archivado, categoría oculta o inexistente → 404.
 *
 * Lo que depende de quién mira (borradores) se lee dentro de <Suspense>.
 */

/** Los productos publicados se arman de antemano. */
export async function generateStaticParams() {
  const slugs = await getPublishedProductSlugs();
  // Con cacheComponents hace falta al menos uno para validar la ruta al compilar.
  return slugs.length > 0 ? slugs.map((slug) => ({ slug })) : [{ slug: "inicio" }];
}

/** Descripción para Google: el comienzo de la descripción del producto, o una armada con el nombre. */
function metaDescription(p: ProductDetail): string {
  const text = p.description?.replace(/\s+/g, " ").trim();
  if (text) return text.length > 160 ? `${text.slice(0, 157).trimEnd()}…` : text;
  return `${p.card.name} en Home Deko, artículos del hogar. Comprá online con envío a todo el país o retiro en el local en Trevelin, Chubut.`;
}

export async function generateMetadata({ params }: PageProps<"/productos/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  // La versión pública: un borrador no tiene título para Google (solo lo ven los admins).
  const product = await getPublishedProduct(slug);
  if (!product) return { title: "No encontramos esta página" };

  const description = metaDescription(product);
  const image = product.photos[0];
  return {
    title: product.card.name,
    description,
    alternates: { canonical: productHref(product.card.slug) },
    openGraph: {
      title: `${product.card.name} · Home Deko`,
      description,
      ...(image ? { images: [{ url: image.url, alt: image.alt || product.card.name }] } : {}),
    },
  };
}

export default function ProductPage({ params }: PageProps<"/productos/[slug]">) {
  return (
    <main className={cn(STORE_CONTAINER, "flex flex-col gap-5 pt-5 pb-14 md:pt-6 lg:gap-8 lg:pb-20")}>
      {/* Lee la sesión (los admins ven borradores) */}
      <Suspense fallback={<ProductSkeleton />}>
        <ProductContent params={params} />
      </Suspense>
    </main>
  );
}

async function ProductContent({ params }: Pick<PageProps<"/productos/[slug]">, "params">) {
  const { slug } = await params;
  const [product, settings] = await Promise.all([getProductForViewer(slug), getStoreSettings()]);
  if (!product) notFound();

  const { card, category } = product;
  const pricing = pricingFrom(settings);
  const crumbs: Crumb[] = [
    category ? { label: category.name, href: categoryHref(category.slug) } : ALL_PRODUCTS_LINK,
    { label: card.name, href: productHref(card.slug) },
  ];

  return (
    <>
      <Breadcrumbs items={crumbs} />
      <ProductPurchase
        product={card}
        options={product.options}
        variants={product.variants}
        photos={product.photos}
        pricing={pricing}
        nationalTaxPercent={settings.showPriceWithoutTaxes ? settings.nationalTaxPercent : null}
      >
        <ProductDetails product={product} settings={settings} />
      </ProductPurchase>
      {!card.isDraft && <ProductJsonLd product={product} pricing={pricing} />}
      {/* "Más vistos" del Inicio del panel (anónimo; los borradores solo los ven admins) */}
      {!card.isDraft && <ProductViewTracker productId={card.id} />}
      {category && <RelatedProducts categoryId={category.id} productId={card.id} pricing={pricing} />}
    </>
  );
}

/** Envío, consulta por WhatsApp y descripción (columna de la derecha, debajo del botón). */
function ProductDetails({ product, settings }: { product: ProductDetail; settings: StoreSettings }) {
  const base = siteUrl();
  const url = base ? `${base}${productHref(product.card.slug)}` : "";
  const whatsapp = whatsappLink(
    settings,
    `Hola Home Deko, quería consultar por "${product.card.name}"${url ? `: ${url}` : "."}`,
  );
  const pickup = [settings.storeAddress, settings.storeHours].filter(Boolean).join(" · ");

  return (
    <>
      <ul className="flex flex-col divide-y rounded-2xl border text-sm">
        <li className="flex gap-3 p-4">
          <Truck aria-hidden className="mt-0.5 size-5 shrink-0 text-brand" />
          <p>
            <span className="font-semibold">Envío a domicilio: </span>
            <span className="tabular-nums">{formatPrice(settings.shippingCost)}</span> a todo el
            país.
          </p>
        </li>
        <li className="flex gap-3 p-4">
          <Store aria-hidden className="mt-0.5 size-5 shrink-0 text-brand" />
          <p>
            <span className="font-semibold">Retiro en el local: gratis.</span>
            {pickup && <span className="block text-muted-foreground">{pickup}</span>}
          </p>
        </li>
      </ul>

      {whatsapp && (
        <a
          href={whatsapp}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-11 items-center justify-center gap-2 self-start rounded-full border px-5 text-sm font-semibold transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/20 focus-visible:outline-none"
        >
          <WhatsAppIcon className="size-5 text-[#25D366]" />
          Consultar por este producto
          <span className="sr-only"> (se abre WhatsApp en otra pestaña)</span>
        </a>
      )}

      {product.description && (
        <section aria-labelledby="descripcion" className="flex flex-col gap-2 border-t pt-6">
          <h2 id="descripcion" className="font-display text-xl font-semibold">
            Descripción
          </h2>
          {/* whitespace-pre-line: respeta los saltos de línea que cargan en el panel */}
          <p className="text-[15px] leading-7 whitespace-pre-line text-foreground/85">{product.description}</p>
        </section>
      )}
    </>
  );
}

/**
 * Datos estructurados para Google ("Product"): nombre, fotos, precio y si
 * hay stock. Con eso Google puede mostrar el precio en el resultado.
 */
function ProductJsonLd({ product, pricing }: { product: ProductDetail; pricing: PricingSettings }) {
  const base = siteUrl();
  if (!base) return null;
  const { card, variants } = product;
  const url = `${base}${productHref(card.slug)}`;
  // Precio CONTADO (el que se cobra: create_order cobra final_price, el mismo número)
  const prices = variants.map((v) => getPrices(v, pricing).contado);
  const availability = card.inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock";

  const offers =
    prices.length > 1 && Math.min(...prices) !== Math.max(...prices)
      ? {
          "@type": "AggregateOffer",
          priceCurrency: "ARS",
          lowPrice: Math.min(...prices).toFixed(2),
          highPrice: Math.max(...prices).toFixed(2),
          offerCount: variants.length,
          availability,
          url,
        }
      : {
          "@type": "Offer",
          priceCurrency: "ARS",
          price: (prices[0] ?? getPrices(card, pricing).contado).toFixed(2),
          availability,
          itemCondition: "https://schema.org/NewCondition",
          url,
        };

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: card.name,
    ...(product.description ? { description: product.description.slice(0, 5000) } : {}),
    ...(product.photos.length ? { image: product.photos.map((p) => p.url) } : {}),
    ...(product.category ? { category: product.category.name } : {}),
    url,
    offers: { ...offers, seller: { "@type": "Organization", name: "Home Deko" } },
  };

  return (
    <script
      type="application/ld+json"
      // "<" escapado: un nombre o una descripción nunca pueden cerrar el <script>.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
    />
  );
}

/** Otros productos de la misma categoría (si no hay, no aparece la sección). */
async function RelatedProducts({
  categoryId,
  productId,
  pricing,
}: {
  categoryId: string;
  productId: string;
  pricing: PricingSettings;
}) {
  const products = await getRelatedProducts(categoryId, productId);
  if (products.length === 0) return null;

  return (
    <section aria-labelledby="relacionados" className="mt-8 flex flex-col gap-6 border-t pt-10 lg:mt-10">
      <h2 id="relacionados" className="font-display text-2xl font-semibold tracking-tight md:text-3xl">
        Productos relacionados
      </h2>
      <ul className={HOME_GRID}>
        {products.map((p) => (
          <li key={p.id}>
            <ProductCard product={p} pricing={pricing} sizes={HOME_IMAGE_SIZES} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Mientras carga: la misma forma que la página (galería + columna de compra). */
function ProductSkeleton() {
  return (
    <div className="flex flex-col gap-5 lg:gap-8" aria-busy aria-label="Cargando el producto">
      <div className="h-4 w-48 animate-pulse rounded bg-muted" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-12 xl:gap-16">
        <div className="aspect-square animate-pulse rounded-2xl bg-muted" />
        <div className="flex flex-col gap-4">
          <div className="h-9 w-3/4 animate-pulse rounded bg-muted" />
          <div className="h-8 w-1/3 animate-pulse rounded bg-muted" />
          <div className="mt-4 h-10 w-2/3 animate-pulse rounded-full bg-muted" />
          <div className="h-12 w-full animate-pulse rounded-full bg-muted" />
        </div>
      </div>
    </div>
  );
}
