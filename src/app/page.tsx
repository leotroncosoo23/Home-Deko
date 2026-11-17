import type { Metadata } from "next";
import Link from "next/link";
import { CreditCard, MapPin, Store, Truck, UserRound } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { SiteFooter } from "@/components/site-footer";
import { COMERCIO } from "@/content/legales";

const DESCRIPTION =
  "Tienda online de Home Deko: artículos del hogar, bazar y blanquería, con local en Trevelin, Chubut. Comprá con Mercado Pago, con envío a domicilio o retiro en el local.";

export const metadata: Metadata = {
  // "absolute": sin la plantilla "%s · Home Deko". Google verifica que el
  // nombre de la app ("Home Deko") sea el título de la página de inicio.
  title: { absolute: "Home Deko" },
  description: DESCRIPTION,
  openGraph: { title: "Home Deko", description: DESCRIPTION },
};

/**
 * Página "Muy pronto" (/): lo que ve cualquier visitante mientras la tienda
 * no está lanzada. Es PÚBLICA (el proxy solo protege /admin) y estática.
 *
 * Google la revisa para verificar la marca del inicio de sesión con Google:
 * tiene que mostrar el nombre "Home Deko", explicar qué es el sitio y
 * para qué sirve la cuenta, y tener links a /privacidad y /terminos.
 */
export default function ComingSoonPage() {
  return (
    <div className="flex flex-1 flex-col bg-surface">
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-10 sm:py-16">
        <header className="flex flex-col items-center gap-4 text-center">
          <Logo variant="stacked" preload decorative className="h-auto w-40 sm:w-50" />
          <span className="rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold tracking-[0.08em] text-brand uppercase">
            Muy pronto
          </span>
          <h1 className="font-display text-4xl leading-tight font-semibold tracking-tight sm:text-5xl">
            Home Deko
          </h1>
          <p className="max-w-lg text-[17px] leading-7 text-muted-foreground">
            Artículos del hogar, bazar y blanquería en Trevelin, Chubut.
            <br className="hidden sm:block" /> Estamos preparando nuestra tienda online.
          </p>
        </header>

        <section aria-labelledby="que-es" className="surface-card flex flex-col gap-5 p-5 sm:p-8">
          <h2 id="que-es" className="text-lg font-semibold tracking-tight">
            Qué vas a encontrar en este sitio
          </h2>
          <ul className="flex flex-col gap-5">
            <Feature icon={Store} title="La tienda online de Home Deko">
              Somos un local de artículos del hogar, bazar y blanquería en {COMERCIO.direccion}. En
              este sitio vas a poder ver nuestro catálogo y comprar desde tu casa.
            </Feature>
            <Feature icon={CreditCard} title="Compra online con Mercado Pago">
              Pagás de forma segura con Mercado Pago: tarjeta de crédito, débito o dinero en cuenta.
            </Feature>
            <Feature icon={Truck} title="Envío a domicilio o retiro en el local">
              Te lo enviamos a cualquier lugar del país ({COMERCIO.envioDomicilio}, precio fijo) o lo
              retirás gratis en el local.
            </Feature>
            <Feature icon={UserRound} title="Tu cuenta, con Google">
              Podés crear una cuenta con tu cuenta de Google para ver tus pedidos y seguir su estado
              (preparando, enviado, listo para retirar). Solo usamos tu nombre, tu email y tu foto de
              perfil: te lo explicamos en la{" "}
              <Link href="/privacidad#google" className="font-medium text-foreground underline underline-offset-4">
                Política de privacidad
              </Link>
              .
            </Feature>
          </ul>
        </section>

        <p className="flex items-start justify-center gap-2 text-center text-sm text-muted-foreground">
          <MapPin aria-hidden className="mt-0.5 size-4 shrink-0 text-brand" />
          <span>
            Mientras tanto, te esperamos en el local: {COMERCIO.direccion}.
          </span>
        </p>
      </main>

      <SiteFooter />
    </div>
  );
}

function Feature({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-4">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-soft">
        <Icon aria-hidden className="size-5 text-brand" />
      </span>
      <div className="flex flex-col gap-1">
        <h3 className="font-semibold">{title}</h3>
        <p className="text-[15px] leading-6 text-muted-foreground">{children}</p>
      </div>
    </li>
  );
}
