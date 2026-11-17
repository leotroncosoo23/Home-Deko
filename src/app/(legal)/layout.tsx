import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { SiteFooter } from "@/components/site-footer";

/**
 * Marco de las páginas legales (/privacidad y /terminos).
 *
 * "(legal)" es un grupo de rutas: los paréntesis hacen que NO aparezca en la
 * URL. Sirve solo para que las dos páginas compartan este layout.
 *
 * Todo es estático (no lee cookies ni la sesión), así que Next las arma una
 * sola vez al compilar y se sirven al instante. Estas páginas tienen que
 * verse SIEMPRE, también en modo construcción: ver src/lib/public-routes.ts.
 */
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col bg-surface">
      <header className="border-b bg-background">
        <div className="mx-auto flex w-full max-w-2xl justify-center px-4 py-6">
          <Link href="/" aria-label="Ir a la tienda de Home Deko" className="rounded-md">
            <Logo variant="stacked" preload className="h-auto w-35" />
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:py-12">{children}</main>

      <SiteFooter />
    </div>
  );
}
