import Image from "next/image";
import { cn } from "@/lib/utils";
import apiladoBlanco from "../../../public/brand/logo-apilado-blanco.png";
import apiladoNegro from "../../../public/brand/logo-apilado-negro.png";
import horizontalBlanco from "../../../public/brand/logo-horizontal-blanco.png";
import horizontalNegro from "../../../public/brand/logo-horizontal-negro.png";

type LogoProps = {
  /** "horizontal": barra lateral y encabezados. "stacked" (apilado): login y páginas legales. */
  variant?: "horizontal" | "stacked";
  /** "dark": logo negro (fondos claros). "light": logo blanco (fondos rojos). */
  tone?: "dark" | "light";
  /** Ajustá el tamaño con el alto o el ancho, ej.: "h-10 w-auto" o "w-50 h-auto". */
  className?: string;
  /** Precargar la imagen: usarlo solo donde el logo se ve apenas abre la página. */
  preload?: boolean;
  /** true si al lado ya está escrito "Home Deko" (así el lector de pantalla no lo repite). */
  decorative?: boolean;
};

const FILES = {
  horizontal: { dark: horizontalNegro, light: horizontalBlanco },
  stacked: { dark: apiladoNegro, light: apiladoBlanco },
} as const;

/**
 * Ancho máximo con el que se muestra cada variante (en px CSS). El navegador
 * lo multiplica por la densidad de la pantalla (2x, 3x) y baja la versión
 * justa, así se ve nítido en celular sin descargar el archivo original.
 * Si un lugar muestra el logo más grande, subir este valor.
 */
const SIZES = {
  horizontal: "133px",
  stacked: "200px",
} as const;

/** Logo de Home Deko (archivos reales en public/brand/). */
export function Logo({
  variant = "horizontal",
  tone = "dark",
  className,
  preload,
  decorative,
}: LogoProps) {
  return (
    <Image
      // width/height salen del archivo importado: proporción exacta, sin
      // deformarse ni avisos de Next. El tamaño en pantalla lo da className.
      src={FILES[variant][tone]}
      alt={decorative ? "" : "Home Deko"}
      sizes={SIZES[variant]}
      // Los trazos finos del logo se notan con la compresión por defecto (75)
      quality={90}
      preload={preload}
      className={cn(variant === "horizontal" ? "h-10 w-auto" : "h-auto w-50", className)}
    />
  );
}
