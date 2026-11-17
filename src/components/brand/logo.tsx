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
};

const FILES = {
  horizontal: { dark: horizontalNegro, light: horizontalBlanco },
  stacked: { dark: apiladoNegro, light: apiladoBlanco },
} as const;

/**
 * Tamaño en pantalla de referencia (en px CSS). NO es el tamaño del archivo:
 * Next usa este ancho para armar las versiones 1x / 2x (srcset), así el
 * celular baja una imagen chica pero nítida en pantallas de alta densidad.
 * Si un lugar muestra el logo bastante más grande, conviene subir estos valores.
 */
const DISPLAY = {
  horizontal: { width: 133, height: 40 },
  stacked: { width: 200, height: 150 },
} as const;

/** Logo de Home Deko (archivos reales en public/brand/). */
export function Logo({ variant = "horizontal", tone = "dark", className, preload }: LogoProps) {
  return (
    <Image
      src={FILES[variant][tone]}
      alt="Home Deko"
      width={DISPLAY[variant].width}
      height={DISPLAY[variant].height}
      // Los trazos finos del logo se notan con la compresión por defecto (75)
      quality={90}
      preload={preload}
      className={cn(variant === "horizontal" ? "h-10 w-auto" : "h-auto w-50", className)}
    />
  );
}
