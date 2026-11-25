import { after } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { classifyVisitSource } from "@/lib/visit-source";

/**
 * POST /api/visita — contador ANÓNIMO de visitas (lo llama VisitTracker).
 *
 * Qué llega (nada personal): el tipo ("v" = visita, "p" = producto visto),
 * el DOMINIO de la página anterior y el utm_source del link. No se guarda la
 * IP, el navegador ni ningún identificador: solo se suma 1 a un contador del día.
 *
 * Qué NO se cuenta:
 *   - pedidos que no vienen de la propia tienda (Origin / Sec-Fetch-Site);
 *   - bots y robots (por el navegador que dicen ser);
 *   - los administradores (sesión con rol admin).
 *
 * Siempre responde 204 y nunca muestra errores: el contador no puede
 * molestar a quien está comprando. La suma se hace con after(), cuando la
 * respuesta ya salió.
 *
 * Esta ruta está FUERA del proxy (matcher de src/proxy.ts): no renueva la
 * sesión ni pasa por el modo construcción, así es lo más liviana posible.
 */

const NO_CONTENT = () => new Response(null, { status: 204 });

const BOT_UA =
  /bot|crawl|spider|slurp|preview|fetch|scan|monitor|headless|lighthouse|pagespeed|facebookexternalhit|whatsapp\/|telegrambot|discordbot|curl|wget|python|axios|node-fetch|go-http|java\//i;

const Body = z.discriminatedUnion("k", [
  z.object({
    k: z.literal("v"),
    ref: z.string().max(255).optional(),
    utm: z.string().max(60).optional(),
  }),
  z.object({
    k: z.literal("p"),
    pid: z.uuid(),
  }),
]);

export async function POST(request: Request) {
  try {
    if (!isSameSite(request)) return NO_CONTENT();
    if (BOT_UA.test(request.headers.get("user-agent") ?? "")) return NO_CONTENT();

    const text = await request.text();
    if (text.length > 1000) return NO_CONTENT();
    const parsed = Body.safeParse(JSON.parse(text));
    if (!parsed.success) return NO_CONTENT();

    if (await isAdminSession(request)) return NO_CONTENT();

    const body = parsed.data;
    const host = request.headers.get("host");
    after(async () => {
      try {
        const supabase = createAdminClient();
        if (body.k === "v") {
          const source = classifyVisitSource({ utmSource: body.utm, referrerHost: body.ref, siteHost: host });
          await supabase.rpc("track_visit", { p_source: source });
        } else {
          await supabase.rpc("track_product_view", { p_product_id: body.pid });
        }
      } catch {
        // Sin conexión o la base no responde: esta visita no se cuenta. No pasa nada.
      }
    });
  } catch {
    // JSON roto u otra rareza: se ignora.
  }
  return NO_CONTENT();
}

/** Solo desde la propia tienda (el navegador manda Origin en los POST). */
function isSameSite(request: Request): boolean {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin") return false;
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/**
 * ¿Es un admin? Solo se mira si hay cookie de sesión de Supabase ("sb-…"):
 * a un visitante sin sesión no se le hace ninguna consulta.
 * El rol viaja dentro del token (Custom Access Token Hook), como en el proxy.
 */
async function isAdminSession(request: Request): Promise<boolean> {
  const cookie = request.headers.get("cookie") ?? "";
  if (!/(^|;\s*)sb-/.test(cookie)) return false;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    return data?.claims?.user_role === "admin";
  } catch {
    return false;
  }
}
