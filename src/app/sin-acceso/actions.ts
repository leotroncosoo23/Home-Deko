"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Pide un token de sesión NUEVO y entra al panel.
 *
 * Sirve cuando el rol del token quedó viejo: por ejemplo, alguien que
 * recién agregaron a admin_emails, o una sesión iniciada antes de activar
 * el hook. El token nuevo trae el rol actual (lo agrega el hook).
 */
export async function refreshSessionAndEnter(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.refreshSession();
  redirect("/admin");
}
