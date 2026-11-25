"use client";

import { useState } from "react";
import { MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Mapa de Google del local, SIN clave de API (la URL pública "?output=embed").
 *
 * Se carga recién cuando la persona toca "Ver el mapa": así la página es
 * liviana y Google no deja cookies a quien no lo pidió.
 */
export function MapEmbed({ address }: { address: string }) {
  const [show, setShow] = useState(false);
  const query = encodeURIComponent(address);

  if (show) {
    return (
      <iframe
        title={`Mapa: ${address}`}
        src={`https://www.google.com/maps?q=${query}&output=embed`}
        className="aspect-[4/3] w-full rounded-2xl border-0 sm:aspect-[16/9]"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        allowFullScreen
      />
    );
  }

  return (
    <div className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-3 rounded-2xl bg-brand-soft/60 p-6 text-center sm:aspect-[16/9]">
      <span className="flex size-12 items-center justify-center rounded-full bg-background text-brand">
        <MapPin aria-hidden className="size-6" />
      </span>
      <p className="max-w-xs text-sm text-muted-foreground">El mapa lo muestra Google: se carga solo si lo pedís.</p>
      <Button variant="outline" onClick={() => setShow(true)}>
        Ver el mapa
      </Button>
    </div>
  );
}
