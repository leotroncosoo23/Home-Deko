"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/redirects";

/** Lo que el formulario recibe de vuelta después de enviar. */
export type AuthFormState = {
  error?: string;
  success?: string;
  email?: string; // para no borrar lo que escribió el usuario si hay error
};

/**
 * Origin actual (ej. http://localhost:3000 o https://homedeko.vercel.app).
 * Se usa para que Supabase/Google devuelvan al usuario al MISMO sitio
 * desde donde inició sesión (en local vuelve a localhost).
 */
async function getOrigin(): Promise<string> {
  const h = await headers();
  const origin = h.get("origin");
  if (origin) return origin;
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

function callbackUrl(origin: string, next: string) {
  return `${origin}/auth/callback?next=${encodeURIComponent(next)}`;
}

/** Traduce los errores de Supabase Auth a mensajes claros en español. */
function translateAuthError(code: string | undefined, message: string): string {
  switch (code) {
    case "invalid_credentials":
      return "Email o contraseña incorrectos.";
    case "email_not_confirmed":
      return "Todavía no confirmaste tu email. Revisá tu casilla (y la carpeta de spam).";
    case "user_already_exists":
    case "email_exists":
      return "Ese email ya está registrado. Ingresá con tu contraseña o con Google.";
    case "weak_password":
      return "La contraseña es muy débil. Usá al menos 8 caracteres, combinando letras y números.";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "Hubo demasiados intentos. Esperá unos minutos y probá de nuevo.";
    case "signup_disabled":
      return "El registro de cuentas nuevas está desactivado.";
    case "email_address_invalid":
      return "Ese email no es válido.";
    default:
      console.error("Error de Supabase Auth:", code, message);
      return "Ocurrió un error inesperado. Probá de nuevo en un momento.";
  }
}

function readFields(formData: FormData) {
  return {
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    password: String(formData.get("password") ?? ""),
    next: safeNext(String(formData.get("next") ?? "")),
  };
}

// ---------------------------------------------------------------------
// Ingresar con email y contraseña
// ---------------------------------------------------------------------
export async function signInWithPassword(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const { email, password, next } = readFields(formData);

  if (!email || !password) {
    return { error: "Completá el email y la contraseña.", email };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: translateAuthError(error.code, error.message), email };
  }

  // redirect() corta la ejecución: va afuera de cualquier try/catch.
  redirect(next);
}

// ---------------------------------------------------------------------
// Crear cuenta con email y contraseña
// (crear una cuenta NO da permisos: el rol admin sale de admin_emails)
// ---------------------------------------------------------------------
export async function signUp(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const { email, password, next } = readFields(formData);

  if (!email || !password) {
    return { error: "Completá el email y la contraseña.", email };
  }
  if (password.length < 8) {
    return { error: "La contraseña tiene que tener al menos 8 caracteres.", email };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // El link del email de confirmación vuelve a este mismo sitio
      emailRedirectTo: callbackUrl(await getOrigin(), next),
    },
  });

  if (error) {
    return { error: translateAuthError(error.code, error.message), email };
  }

  // Por seguridad, Supabase no avisa con un error si el email ya existía:
  // devuelve un usuario "vacío" (sin identidades).
  if (data.user && data.user.identities?.length === 0) {
    return { error: translateAuthError("user_already_exists", ""), email };
  }

  return {
    success: `Te enviamos un email a ${email}. Abrí el link para confirmar tu cuenta.`,
    email,
  };
}

// ---------------------------------------------------------------------
// Continuar con Google
// ---------------------------------------------------------------------
export async function signInWithGoogle(formData: FormData): Promise<void> {
  const next = safeNext(String(formData.get("next") ?? ""));

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: callbackUrl(await getOrigin(), next),
    },
  });

  if (error || !data.url) {
    console.error("Error al iniciar sesión con Google:", error);
    redirect("/login?error=google");
  }

  // Lleva al usuario a la pantalla de Google
  redirect(data.url);
}
