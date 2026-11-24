import Link from "next/link";
import { CreditCard, Store, Truck, UserRound } from "lucide-react";
import { highlightMissing } from "@/components/legal/legal-document";
import type { DatosComercio } from "@/content/legales";

/**
 * "Cómo comprar": qué es la tienda, cómo se paga, envío o retiro y para
 * qué sirve la cuenta con Google. Lo usan "Muy pronto" y el inicio.
 *
 * IMPORTANTE: Google revisa la página de inicio para verificar la marca del
 * inicio de sesión con Google. Este texto (qué es el sitio, cómo se compra
 * y para qué sirve la cuenta, con el link a la privacidad) tiene que estar.
 */
export function StoreHighlights({
  comercio,
  upcoming = false,
  className,
}: {
  comercio: DatosComercio;
  /** true en "Muy pronto": "vas a poder ver" en vez de "podés ver". */
  upcoming?: boolean;
  className?: string;
}) {
  return (
    <ul className={className ?? "flex flex-col gap-5"}>
      <Feature icon={Store} title="La tienda online de Home Deko">
        Somos un local de artículos del hogar, bazar y blanquería en {highlightMissing(comercio.direccion)}.
        En este sitio {upcoming ? "vas a poder ver" : "podés ver"} nuestro catálogo y comprar desde tu casa.
      </Feature>
      <Feature icon={CreditCard} title="Compra online con Mercado Pago">
        Pagás de forma segura con Mercado Pago: tarjeta de crédito, débito o dinero en cuenta.
      </Feature>
      <Feature icon={Truck} title="Envío a domicilio o retiro en el local">
        Te lo enviamos a cualquier lugar del país ({comercio.envioDomicilio}, precio fijo) o lo retirás
        gratis en el local.
      </Feature>
      <Feature icon={UserRound} title="Tu cuenta, con Google o con tu email">
        Podés entrar con tu cuenta de Google o con tu email y un código que te mandamos (sin
        contraseñas) para ver tus pedidos y seguir su estado (preparando, enviado, listo para
        retirar) y guardar tu dirección. Si entrás con Google, solo usamos tu nombre, tu email y tu
        foto de perfil: te lo explicamos en la{" "}
        <Link href="/privacidad#google" className="font-medium text-foreground underline underline-offset-4">
          Política de privacidad
        </Link>
        .
      </Feature>
    </ul>
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
