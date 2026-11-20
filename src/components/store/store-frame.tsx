import { Suspense } from "react";
import { AdminBar } from "@/app/(tienda)/_components/admin-bar";
import { SiteFooter } from "@/components/site-footer";
import { AnnouncementBar } from "./announcement-bar";
import { CartProvider } from "./cart/cart-provider";
import { StoreHeader } from "./store-header";
import { WhatsAppButton } from "./whatsapp-button";

/**
 * Marco completo de la tienda:
 *
 *   [barra de admin]   ← solo con sesión de admin (lee la sesión: <Suspense>)
 *   [anuncio]          ← mensaje de Configuración (vacío = no aparece)
 *   [encabezado]       ← logo, menú, buscador y carrito (estático)
 *   [página]
 *   [pie]              ← redes, información y datos del comercio (estático)
 *   [WhatsApp]         ← botón flotante
 *
 * Lo usan el layout de la tienda y la página "No encontramos esta página".
 *
 * CartProvider envuelve todo: el ícono del encabezado, las tarjetas y la
 * página de producto comparten el mismo carrito (y un solo panel y aviso).
 */
export function StoreFrame({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      <div className="flex flex-1 flex-col bg-background">
        <Suspense fallback={null}>
          <AdminBar />
        </Suspense>
        <AnnouncementBar />
        <StoreHeader />
        <div className="flex flex-1 flex-col">{children}</div>
        <SiteFooter />
        <WhatsAppButton />
      </div>
    </CartProvider>
  );
}
