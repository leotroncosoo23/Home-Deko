import { getStoreSettings, whatsappLink } from "@/lib/store-settings";
import { WhatsAppIcon } from "./whatsapp-icon";

/**
 * Botón flotante de WhatsApp (abajo a la derecha), con un mensaje ya
 * escrito. Usa el número de Configuración; si no hay número, no aparece.
 *
 * Verde de WhatsApp a propósito: es el color que la gente reconoce al
 * instante para "escribir por WhatsApp" (el rojo queda para comprar).
 */
export async function WhatsAppButton() {
  const href = whatsappLink(await getStoreSettings());
  if (!href) return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Escribinos por WhatsApp (se abre en otra pestaña)"
      // env(safe-area-inset-bottom): en iPhone no queda tapado por la barra de inicio
      className="fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 inline-flex size-14 items-center justify-center gap-2 rounded-full bg-[#25D366] text-white shadow-lg shadow-black/15 transition-transform hover:scale-105 focus-visible:ring-4 focus-visible:ring-[#25D366]/40 focus-visible:outline-none sm:right-6 sm:bottom-6 md:h-12 md:w-auto md:px-5"
    >
      <WhatsAppIcon />
      <span className="hidden text-sm font-semibold md:inline">Consultanos</span>
    </a>
  );
}
