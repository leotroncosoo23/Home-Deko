import Link from "next/link";
import { highlightMissing } from "@/components/legal/legal-document";
import { COMERCIO } from "@/content/legales";

/**
 * Pie de página público: links a las páginas legales y datos del comercio.
 * Lo usan la página "Muy pronto" (/) y las páginas legales. Google pide que
 * los links a /privacidad y /terminos se vean en la página de inicio.
 */
export function SiteFooter() {
  return (
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
  );
}
