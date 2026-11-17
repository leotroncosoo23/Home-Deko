/**
 * Utilidades para Google Identity Services (GIS): el botón oficial de
 * "Continuar con Google". Solo se usan en el navegador.
 *
 * Flujo (guía oficial de Supabase "Sign in with Google" con el botón propio
 * de Google):
 *   1. Generamos un nonce al azar y su hash SHA-256.
 *   2. El HASH se le pasa a Google; Google lo mete dentro del ID token.
 *   3. El nonce CRUDO se le pasa a Supabase en signInWithIdToken(); Supabase
 *      lo hashea y verifica que coincida con el del token (evita que alguien
 *      reutilice un token robado).
 *
 * Como el popup de Google se abre desde NUESTRO dominio, Google muestra
 * "homedekotrevelin.com" y no el dominio de Supabase.
 */

const SCRIPT_SRC = "https://accounts.google.com/gsi/client";

// ---------------------------------------------------------------------
// Tipos mínimos de google.accounts.id (solo lo que usamos)
// ---------------------------------------------------------------------
export type GoogleCredentialResponse = {
  credential: string; // el ID token (JWT)
  select_by?: string;
};

export type GoogleButtonText = "continue_with" | "signin_with" | "signup_with" | "signin";

type GoogleIdConfiguration = {
  client_id: string;
  callback: (response: GoogleCredentialResponse) => void;
  nonce?: string;
  ux_mode?: "popup" | "redirect";
  auto_select?: boolean;
  cancel_on_tap_outside?: boolean;
  itp_support?: boolean;
  use_fedcm_for_button?: boolean;
  use_fedcm_for_prompt?: boolean;
};

type GoogleButtonConfiguration = {
  type?: "standard" | "icon";
  theme?: "outline" | "filled_blue" | "filled_black";
  size?: "large" | "medium" | "small";
  text?: GoogleButtonText;
  shape?: "rectangular" | "pill" | "circle" | "square";
  logo_alignment?: "left" | "center";
  width?: number;
  locale?: string;
};

export type GoogleAccountsId = {
  initialize: (config: GoogleIdConfiguration) => void;
  renderButton: (parent: HTMLElement, options: GoogleButtonConfiguration) => void;
  cancel: () => void;
  disableAutoSelect: () => void;
};

declare global {
  interface Window {
    google?: { accounts: { id: GoogleAccountsId } };
  }
}

// ---------------------------------------------------------------------
// Carga del script (una sola vez para toda la app)
// ---------------------------------------------------------------------
let scriptPromise: Promise<GoogleAccountsId> | null = null;

export function loadGoogleIdentityScript(): Promise<GoogleAccountsId> {
  if (window.google?.accounts?.id) return Promise.resolve(window.google.accounts.id);
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<GoogleAccountsId>((resolve, reject) => {
    const done = () => {
      const id = window.google?.accounts?.id;
      if (id) resolve(id);
      else reject(new Error("Google Identity Services no quedó disponible."));
    };

    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
    const script = existing ?? document.createElement("script");
    script.addEventListener("load", done, { once: true });
    script.addEventListener("error", () => reject(new Error("No se pudo cargar el script de Google.")), {
      once: true,
    });

    if (!existing) {
      script.src = SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
  }).catch((error: unknown) => {
    // Si falló (sin internet, bloqueador, etc.), permitir reintentar después
    scriptPromise = null;
    throw error;
  });

  return scriptPromise;
}

// ---------------------------------------------------------------------
// Nonce
// ---------------------------------------------------------------------
/** Devuelve el nonce crudo (para Supabase) y su SHA-256 en hex (para Google). */
export async function createNonce(): Promise<{ raw: string; hashed: string }> {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const raw = btoa(String.fromCharCode(...bytes));
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  const hashed = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return { raw, hashed };
}
