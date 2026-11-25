import Image from "next/image";
import { ImageIcon, type LucideIcon } from "lucide-react";
import { cn } from "cn";
import type { Change } from "@/lib/dashboard-period";
import { formatARS } from "@/lib/format";
import { publicImageUrl } from "@/lib/storage";

/** Piezas chicas que comparten los bloques del Inicio. */

/** "$ 25.000" (sin ",00" cuando es redondo: más fácil de leer en una tarjeta). */
export function money(value: number): string {
  return formatARS(value).replace(/,00$/, "");
}

const compactArs = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  notation: "compact",
  maximumFractionDigits: 1,
});
/** "$ 25 mil", "$ 1,2 M" (para el eje del gráfico). */
export function moneyCompact(value: number): string {
  return compactArs.format(value).replace(/ /g, " ");
}

/**
 * Variación contra el período anterior: "▲ 12 %" (verde) / "▼ 8 %" (rojo).
 * neutral: para números donde subir no es "bueno" ni "malo" (descuentos).
 * Sin datos en los dos períodos no muestra nada (nunca "▼ 100 %" con todo vacío).
 */
export function ChangeLabel({ change, compareLabel, neutral = false }: { change: Change; compareLabel: string; neutral?: boolean }) {
  if (change.kind === "none") return null;
  if (change.kind === "new") {
    return (
      <p className="text-xs text-muted-foreground">
        <span className={cn("font-medium", neutral ? "text-muted-foreground" : "text-emerald-700")}>▲ Nuevo</span>{" "}
        {compareLabel}
      </p>
    );
  }
  const { value } = change;
  const up = value > 0;
  const tone = value === 0 || neutral ? "text-muted-foreground" : up ? "text-emerald-700" : "text-brand";
  const arrow = value === 0 ? "=" : up ? "▲" : "▼";
  // Para el lector de pantalla: "subió 12 %"
  const spoken = value === 0 ? "igual" : up ? `subió ${value} %` : `bajó ${Math.abs(value)} %`;
  return (
    <p className="text-xs text-muted-foreground">
      <span className={cn("font-medium tabular-nums", tone)}>
        <span aria-hidden>
          {arrow} {value === 0 ? "" : `${Math.abs(value).toLocaleString("es-AR")} %`}
        </span>
        <span className="sr-only">{spoken}</span>
      </span>{" "}
      {compareLabel}
    </p>
  );
}

/** Estado vacío amable: ícono suave + una o dos frases. Nunca un gráfico en cero. */
export function EmptyState({
  icon: Icon,
  title,
  children,
  className,
}: {
  icon: LucideIcon;
  title: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 px-4 py-8 text-center", className)}>
      <span className="flex size-11 items-center justify-center rounded-full bg-brand-soft">
        <Icon className="size-5 text-brand" aria-hidden />
      </span>
      <p className="font-medium">{title}</p>
      {children && <p className="max-w-xs text-sm text-balance text-muted-foreground">{children}</p>}
    </div>
  );
}

/** Foto chica de un producto (o un ícono si no tiene). */
export function Thumb({ path }: { path: string | null }) {
  return (
    <span className="relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
      {path ? (
        <Image src={publicImageUrl(path)} alt="" fill sizes="40px" className="object-cover" />
      ) : (
        <ImageIcon className="size-4 text-muted-foreground/60" aria-hidden />
      )}
    </span>
  );
}
