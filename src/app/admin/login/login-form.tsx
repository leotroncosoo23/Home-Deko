"use client";

import { useState } from "react";
import { AlertCircle } from "lucide-react";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";

/**
 * Ingreso del panel: SOLO con Google (todos los admins entran así).
 *
 * Entrar con Google no da permisos: después de iniciar sesión, el proxy
 * manda al panel solo a quien tiene el rol admin (email en admin_emails);
 * cualquier otra cuenta va a /sin-acceso.
 */
export function LoginForm({ next, initialError }: { next: string; initialError?: string }) {
  const [error, setError] = useState<string | undefined>(initialError);

  return (
    <div className="flex flex-col gap-4">
      <GoogleSignInButton redirectTo={next} onError={setError} />
      {error && (
        <div role="alert" className="flex gap-2 rounded-lg bg-brand-soft px-3 py-2.5 text-sm text-brand-hover">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <p>{error}</p>
        </div>
      )}
      <p className="text-center text-xs text-muted-foreground">
        Entrá con la cuenta de Google que tiene acceso al panel.
      </p>
    </div>
  );
}
