import "server-only";

/**
 * Envío de mails con RESEND (API REST directa, sin SDK, como Mercado Pago).
 *
 * Variables (solo servidor):
 *   RESEND_API_KEY → clave "Sending access" de Resend.
 *   EMAIL_FROM     → remitente, ej.: "Home Deko <pedidos@homedekotrevelin.com>"
 *                    (el dominio tiene que estar verificado en Resend).
 *
 * Si falta alguna, NO se manda nada y NO falla: la tienda sigue funcionando y
 * la consola avisa qué falta. Nunca se muestra la clave ni el contenido del mail.
 */

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string | null;
  /**
   * Clave para que un reintento no mande el mismo mail dos veces
   * (Resend la recuerda 24 h). Ej.: "pedido-<id>-pago".
   */
  idempotencyKey?: string;
};

export type EmailResult = { ok: true; id: string } | { ok: false; skipped: boolean; error: string };

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export async function sendEmail(message: EmailMessage): Promise<EmailResult> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) {
    const missing = !key ? "RESEND_API_KEY" : "EMAIL_FROM";
    console.warn(`[email] ${missing} sin configurar: no se envió "${message.subject}".`);
    return { ok: false, skipped: true, error: `Falta configurar ${missing}.` };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        ...(message.idempotencyKey ? { "Idempotency-Key": message.idempotencyKey } : {}),
      },
      body: JSON.stringify({
        from,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
        ...(message.replyTo ? { reply_to: message.replyTo } : {}),
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    const body = (await res.json().catch(() => null)) as { id?: string; message?: string; name?: string } | null;
    if (!res.ok || !body?.id) {
      // El mensaje de Resend explica el problema (ej.: dominio sin verificar); nunca trae la clave.
      const detail = body?.message ?? `Resend respondió ${res.status}`;
      console.error(`[email] no se pudo enviar "${message.subject}": ${detail}`);
      return { ok: false, skipped: false, error: detail };
    }
    return { ok: true, id: body.id };
  } catch {
    console.error(`[email] no se pudo conectar con Resend para "${message.subject}".`);
    return { ok: false, skipped: false, error: "No se pudo conectar con el servicio de mails." };
  }
}
