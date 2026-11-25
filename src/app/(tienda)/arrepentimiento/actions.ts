"use server";

import { after } from "next/server";
import { z } from "zod";
import { sendWithdrawalEmails } from "@/lib/email/withdrawal-emails";
import { visitorKey } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { withdrawalFieldErrors, withdrawalSchema, type WithdrawalResult } from "@/lib/withdrawal-schema";

const GENERIC_ERROR =
  "No pudimos registrar tu solicitud. Probá de nuevo en unos minutos o escribinos por WhatsApp o email.";

const inputSchema = withdrawalSchema.extend({
  // Campo trampa (honeypot): invisible para las personas; los robots lo completan.
  website: z.string().optional(),
});

/**
 * "Enviar solicitud" del Botón de arrepentimiento (Disposición 954/2025).
 *
 * 1. Valida (zod). Sin cuenta ni sesión: cualquiera puede usarlo.
 * 2. create_withdrawal_request (en la base, con la clave secreta): límite de
 *    intentos por visitante y por email, vincula el pedido si número y email
 *    coinciden y genera el código ARR-XXXXXX.
 * 3. Devuelve el código para mostrarlo en pantalla. Los mails (cliente +
 *    dueños) salen con after(): nunca demoran la respuesta.
 */
export async function submitWithdrawal(input: unknown): Promise<WithdrawalResult> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Revisá los datos marcados.", fieldErrors: withdrawalFieldErrors(parsed.error) };
  }
  const data = parsed.data;

  // Un robot completó el campo trampa: respondemos como si nada, sin guardar.
  if (data.website) {
    return { ok: false, error: GENERIC_ERROR };
  }

  const key = await visitorKey("arrepentimiento");
  if (!key) return { ok: false, error: GENERIC_ERROR };

  const supabase = createAdminClient();
  const { data: created, error } = await supabase.rpc("create_withdrawal_request", {
    p: {
      full_name: data.fullName,
      email: data.email,
      order_number: data.orderNumber || null,
      reason: data.reason || null,
    },
    p_key: key,
  });

  if (error) {
    // HD429 / HD422: el texto de la base ya está pensado para el cliente.
    if (error.code === "HD429" || error.code === "HD422") return { ok: false, error: error.message };
    console.error("[arrepentimiento] create_withdrawal_request", error.code, error.message);
    return { ok: false, error: GENERIC_ERROR };
  }

  const result = created as { id?: string; code?: string } | null;
  if (!result?.id || !result.code) {
    console.error("[arrepentimiento] respuesta inesperada de create_withdrawal_request");
    return { ok: false, error: GENERIC_ERROR };
  }

  const id = result.id;
  after(() => sendWithdrawalEmails(id));
  return { ok: true, code: result.code, email: data.email };
}
