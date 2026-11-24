"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Cierra la sesión desde el PANEL (o /sin-acceso) y vuelve al ingreso del panel.
 * Los clientes cierran sesión desde Mi cuenta (signOutCustomer), que vuelve a la tienda.
 */
export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}
