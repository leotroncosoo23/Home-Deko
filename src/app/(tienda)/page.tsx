import type { Metadata } from "next";
import { HeroBanners } from "@/components/store/hero-banner";
import { CategoryShowcase } from "@/components/store/home/category-showcase";
import { ProductStrip } from "@/components/store/home/product-strip";
import { StoreLocation } from "@/components/store/home/store-location";
import { ProductCard } from "@/components/store/product-card";
import { StoreBenefits } from "@/components/store/store-benefits";
import { HowToBuyCompact } from "@/components/store/store-highlights";
import { catalogHref } from "@/lib/catalog-params";
import {
  getActiveBanners,
  getBestSellersStrip,
  getNewArrivals,
  getOnSaleProducts,
  getVisibleCategories,
  type StoreProduct,
} from "@/lib/store-data";
import { STORE_CONTAINER } from "@/lib/store-layout";
import { ALL_PRODUCTS_LINK } from "@/lib/store-nav";
import { datosTienda, getStoreSettings } from "@/lib/store-settings";
import { cn } from "@/lib/utils";

const DESCRIPTION =
  "Home Deko: bazar, blanquería y deco en Trevelin, Chubut. Comprá online con pago seguro con tarjeta, envío a todo el país o retiro gratis en el local.";

export const metadata: Metadata = {
  // "absolute" (sin "· Home Deko"): Google verifica que el título del
  // inicio sea el nombre de la app, "Home Deko". NO cambiarlo.
  title: { absolute: "Home Deko" },
  description: DESCRIPTION,
  openGraph: { title: "Home Deko – Bazar, blanquería y deco en Trevelin", description: DESCRIPTION },
};

/** Ancho de cada foto en las tiras: ~45 % de la pantalla en el celular (2,2 por vista), 1/4 en PC. */
const STRIP_IMAGE_SIZES = "(min-width: 1440px) 320px, (min-width: 768px) 24vw, 45vw";

/**
 * INICIO DE LA TIENDA (/): productos enseguida después del banner.
 *
 *   1. Banner principal (los del panel; 2 o 3 → carrusel) + barra de beneficios
 *   2. Novedades       → los últimos 8 con stock          ("Ver todos": ?orden=nuevos)
 *   3. Categorías      → tarjetas con la foto de portada
 *   4. Ofertas         → hasta 8 con descuento y stock    ("Ver todos": ?ofertas=1)
 *   5. Más vendidos    → con 4 o más vendidos; si no, "Destacados"
 *   6. Estamos en Trevelin (datos de Configuración) + Cómo comprar (corto)
 *
 * Una tira sin productos no se muestra. Todo sale de la caché (igual para
 * todos, también para los admins): el inicio no lee la sesión y carga rápido.
 *
 * Requisitos de Google para verificar la marca (NO quitar): <title> "Home
 * Deko", el <h1> con "Home Deko" (solo para lectores de pantalla), "Cómo
 * comprar" con "Home Deko" en el texto visible (qué es la tienda, cómo se
 * compra y para qué sirve la cuenta con Google) y los links a /privacidad y
 * /terminos en el pie.
 */
export default async function TiendaHomePage() {
  const [banners, categories, settings, newArrivals, onSale, bestSellers] = await Promise.all([
    getActiveBanners(),
    getVisibleCategories(),
    getStoreSettings(),
    getNewArrivals(),
    getOnSaleProducts(),
    getBestSellersStrip(),
  ]);
  // Solo categorías con algún producto publicado (igual que el menú y la barra).
  const categoriesWithProducts = categories.filter((c) => c.productCount > 0);
  const tienda = datosTienda(settings);
  const hasLocation = Boolean(tienda.direccion || tienda.horarios || tienda.instagram);

  return (
    <main className="flex flex-col pb-16">
      <h1 className="sr-only">Home Deko – Bazar, blanquería y deco en Trevelin</h1>

      {/* De borde a borde de la pantalla (sin márgenes ni bordes redondeados).
          1 banner = fijo; 2 o 3 = carrusel. */}
      <HeroBanners banners={banners} />
      <StoreBenefits />

      <div className={cn(STORE_CONTAINER, "flex flex-col gap-12 pt-8 md:gap-16 md:pt-12")}>
        <Strip id="novedades" title="Novedades" href={catalogHref("/productos", { orden: "nuevos" })} products={newArrivals} />

        {categoriesWithProducts.length > 0 && (
          <section aria-labelledby="categorias" className="flex flex-col gap-5 md:gap-6">
            <h2 id="categorias" className="font-display text-2xl leading-tight font-semibold tracking-tight md:text-3xl">
              Categorías
            </h2>
            <CategoryShowcase categories={categoriesWithProducts} />
          </section>
        )}

        <Strip id="ofertas" title="Ofertas" href={catalogHref("/productos", { ofertas: true })} products={onSale} />

        <Strip
          id="mas-vendidos"
          title={bestSellers.kind === "best" ? "Más vendidos" : "Destacados"}
          href={ALL_PRODUCTS_LINK.href}
          products={bestSellers.products}
        />

        {/* PC: el local a la izquierda y Cómo comprar a la derecha (si no hay
            datos del local, Cómo comprar ocupa todo el ancho). */}
        <section
          aria-labelledby="como-comprar"
          className={cn(
            "grid gap-10 rounded-3xl bg-brand-soft/60 px-5 py-9 md:px-10 md:py-12 lg:gap-14",
            hasLocation && "lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]",
          )}
        >
          {hasLocation && <StoreLocation tienda={tienda} />}
          <div className="flex flex-col gap-6">
            <h2 id="como-comprar" className="font-display text-2xl leading-tight font-semibold tracking-tight md:text-3xl">
              Cómo comprar
            </h2>
            <HowToBuyCompact envio={tienda.envio} />
          </div>
        </section>
      </div>
    </main>
  );
}

/** Una tira de productos (no se muestra si está vacía). Las fotos cargan diferidas (lazy). */
function Strip({ id, title, href, products }: { id: string; title: string; href: string; products: StoreProduct[] }) {
  if (products.length === 0) return null;
  return (
    <ProductStrip id={id} title={title} href={href}>
      {products.map((p) => (
        <li key={p.id}>
          <ProductCard product={p} sizes={STRIP_IMAGE_SIZES} />
        </li>
      ))}
    </ProductStrip>
  );
}
