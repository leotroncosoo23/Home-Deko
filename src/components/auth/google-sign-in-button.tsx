"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  createNonce,
  loadGoogleIdentityScript,
  type GoogleButtonText,
} from "@/lib/google-identity";

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

const SIGN_IN_ERROR = "No se pudo iniciar sesión con Google. Probá de nuevo.";
const LOAD_ERROR =
  "No se pudo cargar el botón de Google. Revisá tu conexión o si tenés un bloqueador activo.";

type Status = "loading" | "ready" | "signing-in" | "unavailable";

type Props = {
  /** A dónde ir después de iniciar sesión. Tiene que venir validado con safeNext(). */
  redirectTo: string;
  /** Texto del botón de Google. Por defecto "Continuar con Google". */
  text?: GoogleButtonText;
  /** Se llama con un mensaje en español si algo falla. */
  onError?: (message: string) => void;
};

/**
 * Botón oficial de Google (Google Identity Services) + Supabase signInWithIdToken.
 *
 * Reutilizable: sirve tanto para el login del panel como para el de clientes
 * de la tienda. No decide permisos: después de iniciar sesión hace una
 * navegación completa a `redirectTo` y el proxy / la página destino deciden
 * (admin → panel, sin permiso → /sin-acceso, cliente → su cuenta, etc.).
 */
export function GoogleSignInButton({ redirectTo, text = "continue_with", onError }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<Status>("loading");
  // Se incrementa para volver a dibujar el botón con un nonce nuevo tras un error
  const [attempt, setAttempt] = useState(0);

  // Últimos valores de las props, para no re-inicializar Google en cada render
  const redirectToRef = useRef(redirectTo);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    redirectToRef.current = redirectTo;
    onErrorRef.current = onError;
  });

  useEffect(() => {
    if (!CLIENT_ID) {
      console.error("Falta NEXT_PUBLIC_GOOGLE_CLIENT_ID: no se muestra el botón de Google.");
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const [googleId, nonce] = await Promise.all([loadGoogleIdentityScript(), createNonce()]);
        const container = containerRef.current;
        if (cancelled || !container) return;

        googleId.initialize({
          client_id: CLIENT_ID,
          nonce: nonce.hashed, // a Google va el hash…
          ux_mode: "popup",
          auto_select: false,
          itp_support: true,
          use_fedcm_for_button: true,
          callback: async (response) => {
            setStatus("signing-in");
            const supabase = createClient();
            const { error } = await supabase.auth.signInWithIdToken({
              provider: "google",
              token: response.credential,
              nonce: nonce.raw, // …y a Supabase el nonce crudo
            });

            if (error) {
              console.error("Error de signInWithIdToken:", error.code, error.message);
              onErrorRef.current?.(SIGN_IN_ERROR);
              setStatus("loading");
              setAttempt((n) => n + 1); // nonce nuevo, botón nuevo
              return;
            }

            // Navegación completa: así el proxy lee las cookies de sesión nuevas
            window.location.assign(redirectToRef.current);
          },
        });

        // Google acepta el ancho en px (entre 200 y 400)
        const width = Math.min(400, Math.max(200, Math.floor(container.offsetWidth)));
        container.replaceChildren();
        googleId.renderButton(container, {
          type: "standard",
          theme: "outline",
          size: "large", // 40 px de alto, igual que los demás botones (h-10)
          shape: "rectangular",
          text,
          logo_alignment: "center",
          locale: "es-419",
          width,
        });
        setStatus("ready");
      } catch (error) {
        if (cancelled) return;
        console.error("Google Identity Services:", error);
        setStatus("unavailable");
        onErrorRef.current?.(LOAD_ERROR);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [text, attempt]);

  if (!CLIENT_ID || status === "unavailable") return null;

  return (
    <div className="relative h-10 w-full">
      <div
        ref={containerRef}
        className="flex h-10 w-full justify-center overflow-hidden rounded-lg [color-scheme:light]"
      />

      {status === "loading" && (
        <div className="absolute inset-0 animate-pulse rounded-lg bg-muted" aria-hidden />
      )}

      {status === "signing-in" && (
        <div
          role="status"
          className="absolute inset-0 flex items-center justify-center gap-2 rounded-lg border bg-background text-sm text-muted-foreground"
        >
          <Loader2 className="size-4 animate-spin" />
          Ingresando…
        </div>
      )}
    </div>
  );
}
