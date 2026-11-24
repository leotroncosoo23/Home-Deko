import type { Metadata } from "next";
import { CheckoutView } from "@/components/store/checkout/checkout-view";
import { STORE_CONTAINER } from "@/lib/store-layout";
import { getStoreSettings, whatsappLink } from "@/lib/store-settings";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Finalizar compra",
  robots: { index: false, follow: false },
};

/**
 * /finalizar-compra — checkout con Mercado Pago (Checkout Pro).
 *
 * El servidor solo aporta los datos de Configuración (envío, local,
 * WhatsApp). El carrito vive en el navegador, así que el formulario es un
 * componente de cliente (CheckoutView). El pedido y el pago se arman en la
 * Server Action startCheckout (./actions.ts).
 */
export default async function CheckoutPage() {
  const settings = await getStoreSettings();
  return (
    <main className={cn(STORE_CONTAINER, "flex flex-1 flex-col gap-6 py-8 md:py-12")}>
      <h1 className="font-display text-3xl leading-tight font-semibold tracking-tight md:text-4xl">Finalizar compra</h1>
      <CheckoutView
        store={{
          storeAddress: settings.storeAddress,
          storeHours: settings.storeHours,
          whatsappHref: whatsappLink(settings, "Hola Home Deko, tengo una consulta sobre mi compra."),
        }}
      />
    </main>
  );
}
