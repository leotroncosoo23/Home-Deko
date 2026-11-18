import type { Metadata } from "next";
import Link from "next/link";
import { PackageCheck, ShoppingBag, UserRound } from "lucide-react";
import { ALL_PRODUCTS_LINK } from "@/lib/store-nav";

export const metadata: Metadata = { title: "Mi cuenta" };

/**
 * /mi-cuenta — a donde lleva "Ingresá" / "Mi cuenta" del encabezado.
 *
 * Por ahora explica para qué va a servir la cuenta (texto final para los
 * clientes). En el paso 6 pasa a ser el ingreso real de clientes con Google
 * y "Mis pedidos". /login es SOLO el ingreso del panel: no enlazarlo desde
 * la tienda.
 */
export default function MyAccountPage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-6 px-4 py-16 text-center">
      <span className="flex size-16 items-center justify-center rounded-full bg-brand-soft text-brand">
        <UserRound aria-hidden className="size-7" />
      </span>
      <div className="flex flex-col gap-3">
        <h1 className="font-display text-3xl leading-tight font-semibold md:text-4xl">Tu cuenta en Home Deko</h1>
        <p className="text-[17px] leading-7 text-muted-foreground">
          Muy pronto vas a poder ingresar con tu cuenta de Google para ver tus pedidos y seguir su
          estado. Mientras tanto, podés comprar sin cuenta: solo te pedimos tus datos para el envío.
        </p>
      </div>

      <ul className="flex w-full flex-col gap-3 text-left">
        <li className="flex items-start gap-3 rounded-2xl bg-muted/60 p-4">
          <PackageCheck aria-hidden className="mt-0.5 size-5 shrink-0 text-brand" />
          <span className="text-[15px] leading-6">
            <span className="font-semibold">Seguí tus pedidos:</span> preparando, enviado o listo para retirar.
          </span>
        </li>
        <li className="flex items-start gap-3 rounded-2xl bg-muted/60 p-4">
          <ShoppingBag aria-hidden className="mt-0.5 size-5 shrink-0 text-brand" />
          <span className="text-[15px] leading-6">
            <span className="font-semibold">Con un clic:</span> entrás con tu cuenta de Google, sin crear una contraseña nueva.
          </span>
        </li>
      </ul>

      <Link
        href={ALL_PRODUCTS_LINK.href}
        className="inline-flex h-12 items-center justify-center rounded-full bg-brand px-8 font-semibold text-white transition-colors hover:bg-brand-hover focus-visible:ring-4 focus-visible:ring-brand/30 focus-visible:outline-none"
      >
        Ver productos
      </Link>
    </main>
  );
}
