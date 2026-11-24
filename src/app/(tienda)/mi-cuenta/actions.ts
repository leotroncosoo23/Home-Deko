"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getMyAccount, safeReturnPath } from "@/lib/account";
import {
  accountDetailsSchema,
  accountFieldErrorsFrom,
  detailsToProfileRow,
  type SaveDetailsResult,
} from "@/lib/account-schema";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Cuenta del cliente (paso 6). Ingreso SIN contraseñas:
 *   - Google: lo hace el botón en el navegador; después llama a completeSignIn().
 *   - Email: sendLoginCode() manda un código de 6 dígitos (mail de Supabase
 *     Auth, enviado por el SMTP de Resend) y verifyLoginCode() lo valida.
 *
 * Crear una cuenta NO da permisos: el rol admin sale solo de admin_emails.
 */

const emailSchema = z.string().trim().toLowerCase().pipe(z.email());
const codeSchema = z.string().trim().regex(/^\d{6}$/);

export type LoginResult = { ok: true; redirectTo: string } | { ok: false; error: string };
export type SendCodeResult = { ok: true } | { ok: false; error: string };

const UNEXPECTED = "Ocurrió un error inesperado. Probá de nuevo en un momento.";

/** Errores de Supabase Auth → mensajes para el cliente. */
function authErrorMessage(code: string | undefined, message: string): string {
  switch (code) {
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "Pediste varios códigos seguidos. Esperá un minuto y probá de nuevo.";
    case "otp_expired":
      return "El código venció o no es correcto. Revisalo o pedí uno nuevo.";
    case "email_address_invalid":
    case "validation_failed":
      return "Ese email no es válido. Revisalo, por favor.";
    case "otp_disabled":
    case "signup_disabled":
    case "email_provider_disabled":
      return "Ahora no podemos ingresar con email. Probá con Google o escribinos por WhatsApp.";
    default:
      // Ej.: el SMTP no está configurado o falló el envío ("Error sending … email").
      console.error("[mi-cuenta] Supabase Auth:", code, message);
      return /sending/i.test(message)
        ? "No pudimos mandarte el código en este momento. Probá de nuevo en unos minutos o ingresá con Google."
        : UNEXPECTED;
  }
}

/** Paso 1 del ingreso con email: mandar el código. Si no tiene cuenta, se crea. */
export async function sendLoginCode(rawEmail: unknown): Promise<SendCodeResult> {
  const parsed = emailSchema.safeParse(rawEmail);
  if (!parsed.success) return { ok: false, error: "Revisá el email: parece que falta algo." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data,
    options: { shouldCreateUser: true },
  });
  if (error) return { ok: false, error: authErrorMessage(error.code, error.message) };
  return { ok: true };
}

/** Paso 2: validar el código. La sesión queda guardada en cookies desde el servidor. */
export async function verifyLoginCode(rawEmail: unknown, rawCode: unknown, rawReturnTo: unknown): Promise<LoginResult> {
  const email = emailSchema.safeParse(rawEmail);
  const code = codeSchema.safeParse(rawCode);
  if (!email.success) return { ok: false, error: "Revisá el email: parece que falta algo." };
  if (!code.success) return { ok: false, error: "El código tiene 6 números. Revisalo, por favor." };

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email: email.data, token: code.data, type: "email" });
  if (error) return { ok: false, error: authErrorMessage(error.code, error.message) };

  await linkGuestOrders(supabase);
  return { ok: true, redirectTo: safeReturnPath(rawReturnTo) ?? "/mi-cuenta" };
}

/** Después de ingresar con Google (la sesión ya está en las cookies). */
export async function completeSignIn(rawReturnTo: unknown): Promise<LoginResult> {
  const supabase = await createClient();
  await linkGuestOrders(supabase);
  return { ok: true, redirectTo: safeReturnPath(rawReturnTo) ?? "/mi-cuenta" };
}

/**
 * Suma a la cuenta las compras hechas como invitado con el mismo email.
 * La base solo lo hace si el email está VERIFICADO (link_my_guest_orders).
 * Si falla, el ingreso sigue igual (no es grave: se reintenta al próximo ingreso).
 */
async function linkGuestOrders(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { error } = await supabase.rpc("link_my_guest_orders");
  if (error) console.error("[mi-cuenta] link_my_guest_orders:", error.message);
}

/** "Mis datos": nombre, teléfono y dirección guardada. */
export async function updateMyDetails(input: unknown): Promise<SaveDetailsResult> {
  const parsed = accountDetailsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Revisá los datos marcados.", fieldErrors: accountFieldErrorsFrom(parsed.error) };
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return { ok: false, error: "Tu sesión se cerró. Volvé a ingresar, por favor." };

  // Cliente de SESIÓN: el RLS y el permiso por columna solo dejan cambiar
  // estos datos de la propia fila (nunca el rol).
  const { error } = await supabase.from("profiles").update(detailsToProfileRow(parsed.data)).eq("id", data.claims.sub);
  if (error) {
    console.error("[mi-cuenta] updateMyDetails:", error.message);
    return { ok: false, error: "No pudimos guardar tus datos. Probá de nuevo en un momento." };
  }
  return { ok: true };
}

/** Cerrar sesión desde la tienda: vuelve al inicio. El carrito (en el navegador) no se toca. */
export async function signOutCustomer(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export type DeleteAccountResult = { ok: true } | { ok: false; error: string };

/**
 * "Eliminar mi cuenta" (derecho de supresión, Ley 25.326).
 *
 * - El id sale SOLO de la sesión verificada: nadie puede borrar otra cuenta.
 * - Se borra el usuario de Supabase Auth (email, acceso con Google o código).
 *   Su perfil (nombre, teléfono, dirección guardada) se borra en cascada.
 * - Los pedidos NO se borran: quedan sin cuenta (customer_id → null) porque
 *   son la constancia de una venta y la ley contable obliga a guardarlos.
 * - Las cuentas de administrador no se eliminan desde la tienda.
 */
export async function deleteMyAccount(): Promise<DeleteAccountResult> {
  const account = await getMyAccount();
  if (!account) return { ok: false, error: "Tu sesión se cerró. Volvé a ingresar, por favor." };
  if (account.isAdmin) {
    return { ok: false, error: "Esta es una cuenta del panel de Home Deko: no se puede eliminar desde la tienda." };
  }

  const { error } = await createAdminClient().auth.admin.deleteUser(account.id);
  if (error) {
    console.error("[mi-cuenta] deleteUser:", error.code, error.message);
    return { ok: false, error: "No pudimos eliminar tu cuenta. Probá de nuevo en un momento o escribinos." };
  }

  // Borra las cookies de sesión (el usuario ya no existe; si la llamada a
  // Auth falla, igual se limpian en este navegador).
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
  return { ok: true };
}
