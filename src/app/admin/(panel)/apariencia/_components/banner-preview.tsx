"use client";

import { useState } from "react";
import { Monitor, Smartphone } from "lucide-react";
import { cn } from "cn";
import { HeroBanner } from "@/components/store/hero-banner";
import type { BannerView } from "@/lib/banners";
import { ScaledPreview } from "./scaled-preview";

/** Anchos reales de la tienda: un celular común y el contenido en PC. */
// PC: 1440 px (pantalla común de notebook/monitor): el banner va de borde a borde.
const WIDTHS = { mobile: 390, desktop: 1440 } as const;
type Device = keyof typeof WIDTHS;

/**
 * Vista previa del banner con selector Celular / PC. Usa el MISMO
 * componente que la tienda (HeroBanner): lo que ven es lo que sale.
 */
export function BannerPreview({ banner, initialDevice = "mobile" }: { banner: BannerView | null; initialDevice?: Device }) {
  const [device, setDevice] = useState<Device>(initialDevice);

  return (
    <div className="flex flex-col gap-3">
      <div role="radiogroup" aria-label="Ver la vista previa en" className="flex gap-1 self-center rounded-full bg-muted p-1">
        <DeviceButton active={device === "mobile"} onClick={() => setDevice("mobile")} icon={Smartphone} label="Celular" />
        <DeviceButton active={device === "desktop"} onClick={() => setDevice("desktop")} icon={Monitor} label="PC" />
      </div>

      <div className="rounded-xl bg-muted/60 p-3">
        <ScaledPreview
          // key: al cambiar de dispositivo se vuelve a medir desde cero
          key={device}
          width={WIDTHS[device]}
          className={cn("mx-auto rounded-lg bg-background shadow-sm", device === "mobile" && "max-w-[300px]")}
        >
          <HeroBanner banner={banner} layout={device} />
        </ScaledPreview>
      </div>
    </div>
  );
}

function DeviceButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  label: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/20",
        active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon aria-hidden className="size-4" />
      {label}
    </button>
  );
}
