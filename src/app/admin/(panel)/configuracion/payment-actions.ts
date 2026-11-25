"use server";

import { isDeveloper, requireAdmin } from "@/lib/auth";
import { testGetnetConnection } from "@/lib/payments/getnet";

export type ConnectionResult = { ok: true; message: string } | { ok: false; error: string };

/**
 * "Probar conexión" (tarjeta "Estado de Getnet", solo desarrollador).
 * Pide un token OAuth nuevo y nada más: no crea pagos ni cobra. El token
 * no vuelve al navegador; solo "funciona" o el motivo del error.
 */
export async function testPaymentConnection(): Promise<ConnectionResult> {
  await requireAdmin();
  if (!(await isDeveloper())) return { ok: false, error: "No tenés permiso para esta acción." };

  const result = await testGetnetConnection();
  return result.ok
    ? { ok: true, message: "Conexión con Getnet OK: el token se generó bien." }
    : { ok: false, error: result.error };
}
