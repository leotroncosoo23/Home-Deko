import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight, Star } from "lucide-react";
import { CategoryGrid } from "@/components/store/category-grid";
import { HeroBanners } from "@/components/store/hero-banner";
import { HOME_GRID, HOME_IMAGE_SIZES, ProductCard, ProductGridSkeleton } from "@/components/store/product-card";
import { StoreHighlights } from "@/components/store/store-highlights";
import { getActiveBanners, getVisibleCategories } from "@/lib/store-data";
import { STORE_CONTAINER } from "@/lib/store-layout";
import { ALL_PRODUCTS_LINK } from "@/lib/store-nav";
import { cn } from "@/lib/utils";
import { datosComercio, getStoreSettings } from "@/lib/store-settings";
import { getFeaturedProductsForViewer, getStoreViewer } from "@/lib/store-viewer";

const DESCRIPTION =
  "Tienda online de Home Deko: artículos del hogar, bazar y blanquería en Trevelin, Chubut. Comprá con Mercado Pago, con envío a todo el país o retiro en el local.";

export const metadata: Metadata = {
  // "absolute" (sin "· Home Deko"): Google verifica que el título del
  // inicio sea el nombre de la app, "Home Deko". NO cambiarlo.
  title: { absolute: "Home Deko" },
  description: DESCRIPTION,
  openGraph: { title: "Home Deko", description: DESCRIPTION },
};

/**
 * INICIO DE LA TIENDA (/)
 *
 *   1. Banner principal: los del panel (2 o 3 → carrusel), o el de Home Deko por defecto
 *   2. Bienvenida con el <h1> "Home Deko"
 *   3. Categorías visibles
 *   4. Destacados + "Ver todos los productos"
 *   5. Cómo comprar
 *
 * Requisitos de Google para verificar la marca (NO quitar): <title> y <h1>
 * "Home Deko", texto que explique qué es la tienda, cómo se compra y para
 * qué sirve la cuenta con Google (StoreHighlights), y los links a
 * /privacidad y /terminos en el pie.
 *
 * Todo es estático salvo los destacados: los admins ven también los
 * borradores, así que esa sección lee la sesión (dentro de <Suspense>).
 */
export default async function TiendaHomePage() {
  const [banners, categories, settings] = await Promise.all([
    getActiveBanners(),
    getVisibleCategories(),
    getStoreSettings(),
  ]);
  // Solo categorías con algún producto publicado (igual que el menú y la barra).
  const categoriesWithProducts = categories.filter((c) => c.productCount > 0);

  return (
    <main className="flex flex-col pb-16">
      {/* De borde a borde de la pantalla (sin márgenes ni bordes redondeados).
          1 banner = fijo; 2 o 3 = carrusel. */}
      <HeroBanners banners={banners} />

      <div className={cn(STORE_CONTAINER, "flex flex-col gap-14 pt-10 md:gap-20 md:pt-14")}>
        <header className="flex flex-col items-center gap-2 text-center">
          <h1 className="font-display text-4xl leading-tight font-semibold tracking-tight md:text-5xl">
            Home Deko
          </h1>
          <p className="max-w-xl text-[17px] leading-7 text-muted-foreground">
            Artículos del hogar, bazar y blanquería en Trevelin, Chubut. Elegí desde tu casa y
            recibilo en todo el país o retiralo en el local.
          </p>
        </header>

        {categoriesWithProducts.length > 0 && (
          <section aria-labelledby="categorias" className="flex flex-col gap-6">
            <SectionTitle id="categorias">Categorías</SectionTitle>
            <CategoryGrid categories={categoriesWithProducts} />
          </section>
        )}

        <section aria-labelledby="destacados" className="flex flex-col gap-6">
          <SectionTitle id="destacados">Destacados</SectionTitle>
          <Suspense fallback={<ProductGridSkeleton count={4} />}>
            <FeaturedProducts />
          </Suspense>
          <Link
            href={ALL_PRODUCTS_LINK.href}
            className="inline-flex h-12 items-center justify-center gap-2 self-center rounded-full bg-brand px-8 text-base font-semibold text-white transition-colors hover:bg-brand-hover focus-visible:ring-4 focus-visible:ring-brand/30 focus-visible:outline-none"
          >
            Ver todos los productos
            <ArrowRight aria-hidden className="size-4" />
          </Link>
        </section>

        <section aria-labelledby="como-comprar" className="flex flex-col gap-8 rounded-3xl bg-brand-soft/60 px-5 py-10 md:px-12 md:py-14">
          <SectionTitle id="como-comprar">Cómo comprar</SectionTitle>
          <StoreHighlights comercio={datosComercio(settings)} className="grid gap-8 md:grid-cols-2" />
        </section>
      </div>
    </main>
  );
}

function SectionTitle({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="text-center font-display text-3xl leading-tight font-semibold tracking-tight md:text-4xl">
      {children}
    </h2>
  );
}

/** Destacados: para los admins (vista de admin) incluye los borradores. */
async function FeaturedProducts() {
  const [products, viewer] = await Promise.all([getFeaturedProductsForViewer(), getStoreViewer()]);

  if (products.length === 0) {
    // Los clientes no ven nada (solo el botón "Ver todos los productos").
    if (!viewer.seesAdminView) return null;
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed px-6 py-10 text-center">
        <span className="flex size-11 items-center justify-center rounded-full bg-brand-soft text-brand">
          <Star aria-hidden className="size-5" />
        </span>
        <p className="max-w-sm text-[15px] text-muted-foreground">
          Marcá productos como «Destacado» para que aparezcan acá. Este aviso lo ven solo ustedes.
        </p>
        <Link href="/admin/productos" className="text-sm font-semibold text-foreground underline underline-offset-4">
          Ir a Productos
        </Link>
      </div>
    );
  }

  return (
    <ul className={HOME_GRID}>
      {products.map((p) => (
        <li key={p.id}>
          <ProductCard product={p} sizes={HOME_IMAGE_SIZES} />
        </li>
      ))}
    </ul>
  );
}
