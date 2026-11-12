import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";

type LogoProps = {
  /** "stacked" (apilado): login. "horizontal": barra lateral del panel. */
  variant?: "stacked" | "horizontal";
  className?: string;
};

/**
 * Logo de Home Deko.
 *
 * PROVISORIO: mientras no estén los archivos en public/brand/, se dibuja con
 * texto (Playfair Display + corazón rojo). Cuando estén, reemplazar el
 * contenido por, por ejemplo:
 *
 *   import Image from "next/image";
 *   <Image src="/brand/logo-apilado.svg" alt="Home Deko" width={180} height={90} priority />
 *
 * y el resto de la app no cambia, porque todos usan <Logo />.
 */
export function Logo({ variant = "horizontal", className }: LogoProps) {
  if (variant === "stacked") {
    return (
      <div className={cn("flex flex-col items-center text-center", className)}>
        <span className="font-display text-4xl leading-none font-semibold tracking-tight text-foreground">
          Home Deko
          <Heart
            aria-hidden
            className="ml-1 inline-block size-5 -translate-y-3 fill-brand text-brand"
          />
        </span>
        <span className="mt-2 text-[0.7rem] font-medium tracking-[0.25em] text-muted-foreground uppercase">
          Artículos del hogar
        </span>
      </div>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-display text-xl leading-none font-semibold tracking-tight text-foreground",
        className,
      )}
    >
      Home Deko
      <Heart aria-hidden className="size-3.5 -translate-y-1.5 fill-brand text-brand" />
    </span>
  );
}
