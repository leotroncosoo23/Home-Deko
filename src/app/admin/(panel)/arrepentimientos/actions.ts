"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { STATUS_LABELS } from "./status";

/**
 * Server Actions de Arrepentimientos. Como las demás del panel:
 * requireAdmin() → validar → función de la base (set_withdrawal_status,
 * que vuelve a validar is_admin()) → refresh().
 */

export type ActionResult = { ok: true; message: string } | { ok: false; error: string };

const GENERIC = "No se pudo guardar. Intentá de nuevo en unos segundos.";

const inputSchema = z.object({
  id: z.uuid(),
  status: z.enum(["in_progress", "resolved", "rejected"]),
  note: z.string().trim().max(1000, "La nota puede tener hasta 1000 caracteres."),
});

export async function setWithdrawalStatus(id: string, status: string, note: string): Promise<ActionResult> {
  await requireAdmin();

  const parsed = inputSchema.safeParse({ id, status, note });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? GENERIC };
  const d = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_withdrawal_status", {
    p_id: d.id,
    p_status: d.status,
    p_note: d.note || undefined,
  });
  if (error) {
    if (error.code?.startsWith("HD4")) return { ok: false, error: error.message };
    if (error.code === "42501") return { ok: false, error: "Tu cuenta no tiene permiso para gestionar solicitudes." };
    console.error("[arrepentimientos]", error.code, error.message);
    return { ok: false, error: GENERIC };
  }

  refresh();
  return { ok: true, message: `Solicitud marcada como «${STATUS_LABELS[d.status]}».` };
}
