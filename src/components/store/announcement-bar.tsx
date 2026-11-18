import { getAnnouncements } from "@/lib/store-data";
import { AnnouncementTicker } from "./announcement-ticker";

/**
 * Barra de anuncios de la tienda: los mensajes de "Apariencia de la tienda"
 * (tabla store_announcements, hasta 4). Sin mensajes, no aparece.
 * Los datos llegan de la caché (la tienda sigue siendo estática); cómo se
 * muestran (fijo, cinta o rotación) lo decide AnnouncementTicker.
 */
export async function AnnouncementBar() {
  const messages = await getAnnouncements();
  return <AnnouncementTicker messages={messages} />;
}
