import type { Metadata } from "next";
import { Hammer } from "lucide-react";
import { Logo } from "@/components/brand/logo";

export const metadata: Metadata = {
  // Igual que "Muy pronto": Google verifica que el título del inicio sea
  // "Home Deko". Mantenerlo cuando se arme el inicio real (paso 1).
  title: { absolute: "Home Deko" },
  description: "Tienda online de Home Deko: artículos del hogar, bazar y blanquería en Trevelin, Chubut.",
};

/**
 * Inicio de la tienda (/). Por ahora es un lugar reservado: el inicio real
 * (banner, destacados y categorías) se arma en el paso 1.
 */
export default function TiendaHomePage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-5 px-4 py-16 text-center">
      <Logo variant="stacked" preload decorative className="h-auto w-36 sm:w-44" />
      <h1 className="font-display text-4xl leading-tight font-semibold tracking-tight">Home Deko</h1>
      <p className="inline-flex items-center gap-2 rounded-full bg-brand-soft px-3 py-1 text-sm font-medium text-brand">
        <Hammer aria-hidden className="size-4" />
        Tienda en construcción
      </p>
      <p className="max-w-md text-[15px] leading-6 text-muted-foreground">
        Acá va a ir el inicio de la tienda: el banner principal, los productos destacados y las
        categorías. Lo armamos en el próximo paso.
      </p>
    </main>
  );
}
