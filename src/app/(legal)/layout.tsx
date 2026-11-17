import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { highlightMissing } from "@/components/legal/legal-document";
import { COMERCIO } from "@/content/legales";

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

      <footer className="border-t bg-background">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-3 px-4 py-6 text-sm text-muted-foreground">
          <nav aria-label="Páginas legales" className="flex flex-wrap gap-x-4 gap-y-1">
            <Link href="/privacidad" className="underline-offset-4 hover:text-foreground hover:underline">
              Política de privacidad
            </Link>
            <Link href="/terminos" className="underline-offset-4 hover:text-foreground hover:underline">
              Términos y condiciones
            </Link>
          </nav>
          <p className="text-xs leading-5">
            {COMERCIO.nombre} · {COMERCIO.direccion}
            <br />
            Razón social: {highlightMissing(COMERCIO.razonSocial)} · CUIT: {highlightMissing(COMERCIO.cuit)}
          </p>
        </div>
      </footer>
    </div>
  );
}
