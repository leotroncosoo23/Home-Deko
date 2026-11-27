import { Suspense } from "react";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { cn } from "@/lib/utils";
import { getCategoryTree } from "@/lib/store-data";
import { STORE_CONTAINER } from "@/lib/store-layout";
import { getStoreSettings, redesSociales } from "@/lib/store-settings";
import { AccountLink, AccountLinkFallback } from "./account-link";
import { CartButton } from "./cart-button";
import { CategoryBar } from "./category-bar";
import { MobileSearch } from "./mobile-search";
import { SearchForm } from "./search-form";
import { StoreMenu } from "./store-menu";

/**
 * Encabezado de la tienda, fijo arriba.
 *
 *   Celular / tablet (menos de 1024 px):
 *     [☰] [🔍]     Home ♥ Deko     [👤] [🛍]
 *     (en el menú ☰: "Mi cuenta", o "Panel" si es admin)
 *
 *   Escritorio (desde 1024 px), estilo de las tiendas que toman de referencia:
 *     Home ♥ Deko   [ 🔍 ¿Qué estás buscando? ]   👤 Ingresá   🛍 Carrito (0)
 *     ─────────────────────────────────────────────────────────────────────
 *     Todos los productos  Cocina ▾  Baño  …  Todas las categorías ▾   Ayuda ▾  ↶ Botón de arrepentimiento
 *     (Cocina ▾ = principal con subcategorías: abre el mega menú)
 *
 * Estático (categorías y redes llegan de la caché), salvo "Ingresá / Mi
 * cuenta / Panel", que lee la sesión en su propio <Suspense>.
 */
export async function StoreHeader() {
  // Menú del celular (acordeón) y barra de escritorio (mega menú): principales con
  // algún producto publicado y, debajo, sus subcategorías con productos.
  const [withProducts, settings] = await Promise.all([getCategoryTree(), getStoreSettings()]);

  return (
    <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/85">
      {/* ---------- Celular / tablet: [☰ 🔍]  logo  [👤 🛍] ----------
          Dos íconos de 40 px por lado y el logo centrado (columnas 1fr · auto · 1fr).
          A 360 px: 336 px útiles − logo (~155 px a 28 px de alto) − 2 espacios de 4 px
          = ~86 px por lado, y cada lado necesita 80. Entra. */}
      <div className="relative mx-auto grid h-16 w-full max-w-[1440px] grid-cols-[1fr_auto_1fr] items-center gap-1 px-3 sm:px-4 lg:hidden">
        <div className="flex items-center">
          <StoreMenu
            categories={withProducts}
            redes={redesSociales(settings)}
            account={
              <Suspense fallback={<AccountLinkFallback variant="menu" />}>
                <AccountLink variant="menu" />
              </Suspense>
            }
          />
          <MobileSearch />
        </div>
        <HomeLink className="h-7 sm:h-8" />
        <div className="flex items-center justify-self-end">
          <Suspense fallback={<AccountLinkFallback variant="icon" />}>
            <AccountLink variant="icon" />
          </Suspense>
          <CartButton />
        </div>
      </div>

      {/* ---------- Escritorio ---------- */}
      <div className="hidden lg:block">
        <div className={cn(STORE_CONTAINER, "grid h-20 grid-cols-[1fr_minmax(0,32rem)_1fr] items-center gap-8")}>
          <HomeLink className="h-11" align="start" />
          <SearchForm />
          <div className="flex items-center gap-1 justify-self-end">
            <Suspense fallback={<AccountLinkFallback variant="text" />}>
              <AccountLink variant="text" />
            </Suspense>
            <CartButton withText />
          </div>
        </div>
        {/* Solo las categorías con al menos un producto publicado. La barra va
            siempre: a la derecha tiene "Ayuda" y el Botón de arrepentimiento. */}
        <CategoryBar categories={withProducts} />
      </div>
    </header>
  );
}

/** Logo que lleva al inicio (versión sin la frase: se lee bien a este tamaño). */
function HomeLink({ className, align = "center" }: { className: string; align?: "start" | "center" }) {
  return (
    <Link
      href="/"
      aria-label="Home Deko — Ir al inicio"
      className={`${align === "start" ? "justify-self-start" : "justify-self-center"} rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/20`}
    >
      <Logo variant="wordmark" preload decorative className={`${className} w-auto`} />
    </Link>
  );
}
