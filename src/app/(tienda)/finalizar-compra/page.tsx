import type { Metadata } from "next";
import { CheckoutSoon } from "@/components/store/cart/checkout-soon";
import { STORE_CONTAINER } from "@/lib/store-layout";
import { getStoreSettings } from "@/lib/store-settings";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Finalizar compra",
  robots: { index: false, follow: false },
};

/**
 * /finalizar-compra — a donde lleva "Iniciar compra" del carrito.
 *
 * Nota para Leo: es PROVISORIA. En el paso 4 se reemplaza por el checkout
 * con Mercado Pago. Mientras tanto, ofrece terminar la compra por WhatsApp
 * con el pedido ya escrito (el carrito no se borra).
 */
export default async function CheckoutPage() {
  const settings = await getStoreSettings();
  return (
    <main className={cn(STORE_CONTAINER, "flex flex-1 flex-col items-center py-14 md:py-20")}>
      <CheckoutSoon whatsapp={settings.whatsapp} />
    </main>
  );
}
