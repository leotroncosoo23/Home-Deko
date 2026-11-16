"use client";

import Link from "next/link";
import { ArrowRight, CircleHelp, MessageCircle } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { CONTACTO, GUIAS, whatsappHref, type GuiaId } from "@/content/ayuda";
import { HelpSteps } from "./help-steps";

/**
 * Botón "¿Cómo funciona?" para el encabezado de cada sección. Abre un panel
 * desde la derecha con los pasos rápidos de esa pantalla y un link a la
 * Ayuda completa. Los textos salen de src/content/ayuda.ts.
 *
 * Uso: <PageHeader actions={<HelpSheet guia="stock" />} />
 */
export function HelpSheet({ guia }: { guia: GuiaId }) {
  const g = GUIAS[guia];
  const whatsapp = whatsappHref();

  return (
    <Sheet>
      <SheetTrigger render={<Button variant="outline" />}>
        <CircleHelp aria-hidden /> ¿Cómo funciona?
      </SheetTrigger>

      {/* En el celular ocupa todo el ancho; en PC, un panel de ~450 px */}
      <SheetContent side="right" className="w-full gap-0 data-[side=right]:sm:max-w-md">
        <SheetHeader className="border-b px-5 py-4 pr-12">
          <span className="text-xs font-semibold tracking-[0.08em] text-brand uppercase">Cómo funciona</span>
          <SheetTitle className="text-lg font-semibold">{g.titulo}</SheetTitle>
          <SheetDescription>{g.resumen}</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          <HelpSteps steps={g.pasosRapidos} />
        </div>

        <SheetFooter className="border-t px-5 py-4">
          {/* Al cambiar de página el panel desaparece solo (vive en esta pantalla) */}
          <Link href={`/admin/ayuda#${g.id}`} className={buttonVariants({ className: "w-full" })}>
            Ver la ayuda completa <ArrowRight aria-hidden />
          </Link>
          {whatsapp && (
            <a
              href={whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: "ghost", className: "w-full text-muted-foreground" })}
            >
              <MessageCircle aria-hidden /> ¿Dudas? Escribile a {CONTACTO.nombre}
            </a>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
