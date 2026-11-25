import { Suspense } from "react";
import type { Metadata } from "next";
import { CheckoutSkeleton, CheckoutView } from "@/components/store/checkout/checkout-view";
import type { StoreInfo } from "@/components/store/checkout/checkout-form";
import { getMyAccount } from "@/lib/account";
import { onlinePaymentsAvailable, paymentCopy } from "@/lib/payments/config";
import { STORE_CONTAINER } from "@/lib/store-layout";
import { getStoreSettings, whatsappLink } from "@/lib/store-settings";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Finalizar compra",
  robots: { index: false, follow: false },
};

/**
 * /finalizar-compra — checkout con el medio de pago activo (PAYMENT_PROVIDER:
 * Getnet Web Checkout por defecto, o Mercado Pago Checkout Pro).
 *
 * El servidor aporta los datos de Configuración (envío, local, WhatsApp) y,
 * si el cliente inició sesión, los datos de su cuenta para completar el
 * formulario solo. El carrito vive en el navegador, así que el formulario
 * es un componente de cliente (CheckoutView). El pedido y el pago se arman
 * en la Server Action startCheckout (./actions.ts).
 */
export default async function CheckoutPage() {
  const settings = await getStoreSettings();
  const copy = paymentCopy();
  const store: StoreInfo = {
    storeAddress: settings.storeAddress,
    storeHours: settings.storeHours,
    whatsappHref: whatsappLink(settings, "Hola Home Deko, tengo una consulta sobre mi compra."),
    // Solo textos y un sí/no: ninguna credencial llega al navegador.
    payment: {
      available: onlinePaymentsAvailable(),
      requiresBilling: copy.requiresBilling,
      payButton: copy.payButton,
      redirecting: copy.redirecting,
      secureNote: copy.secureNote,
    },
  };
  return (
    <main className={cn(STORE_CONTAINER, "flex flex-1 flex-col gap-6 py-8 md:py-12")}>
      <h1 className="font-display text-3xl leading-tight font-semibold tracking-tight md:text-4xl">Finalizar compra</h1>
      {/* Lee la sesión → en <Suspense>. El formulario se arma recién con los
          datos de la cuenta, así no "salta" de vacío a completo. */}
      <Suspense fallback={<CheckoutSkeleton />}>
        <CheckoutWithAccount store={store} />
      </Suspense>
    </main>
  );
}

async function CheckoutWithAccount({ store }: { store: StoreInfo }) {
  const account = await getMyAccount();
  return <CheckoutView store={store} account={account ? { email: account.email, details: account.details } : null} />;
}
