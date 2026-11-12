"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Logo } from "@/components/brand/logo";
import { SidebarNav } from "./sidebar-nav";

/**
 * Celular / tablet (menos de 1024 px): botón ☰ que abre la barra lateral
 * como un panel deslizable desde la izquierda. Se cierra solo al elegir
 * una sección.
 */
export function MobileNav({ badges }: { badges?: Record<string, number> }) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button variant="ghost" size="icon-lg" className="-ml-2 lg:hidden" aria-label="Abrir menú" />
        }
      >
        <Menu className="size-5" />
      </SheetTrigger>

      <SheetContent side="left" className="w-72 gap-0 p-0 sm:max-w-72">
        {/* Título para lectores de pantalla (el diálogo necesita uno) */}
        <SheetTitle className="sr-only">Menú del panel</SheetTitle>
        <SheetDescription className="sr-only">Secciones del panel de Home Deko</SheetDescription>

        <div className="flex h-14 items-center border-b px-5">
          <Logo variant="horizontal" />
        </div>
        <div className="p-3">
          <SidebarNav onNavigate={() => setOpen(false)} badges={badges} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
