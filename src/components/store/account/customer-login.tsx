"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { AlertCircle, ArrowLeft, Loader2, MailCheck } from "lucide-react";
import { completeSignIn, sendLoginCode, verifyLoginCode } from "@/app/(tienda)/mi-cuenta/actions";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { Field } from "../form-field";

/** Segundos de espera para pedir otro código (Supabase permite uno por minuto). */
const RESEND_SECONDS = 60;

const BUTTON =
  "inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-brand px-6 text-[15px] font-semibold text-white transition-colors hover:bg-brand-hover focus-visible:ring-3 focus-visible:ring-brand/30 focus-visible:outline-none disabled:opacity-70";

/**
 * Ingreso de clientes en /mi-cuenta, SIN contraseñas:
 *   - Google (el mismo botón oficial que el panel).
 *   - Email: mandamos un código de 6 números y lo escribe acá.
 * Si no tiene cuenta, se crea sola al ingresar. El carrito no se toca: vive
 * en este navegador, aparte de la sesión.
 */
export function CustomerLogin({ returnTo }: { returnTo: string | null }) {
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [wait, setWait] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const [pending, startTransition] = useTransition();
  const codeRef = useRef<HTMLInputElement>(null);
  const busy = pending || leaving;

  // Cuenta regresiva para "Reenviar código".
  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  useEffect(() => {
    if (step === "code") codeRef.current?.focus();
  }, [step]);

  function send(e?: React.FormEvent) {
    e?.preventDefault();
    if (busy) return;
    setError(null);
    startTransition(async () => {
      const result = await sendLoginCode(email).catch(() => null);
      if (!result) return setError("No pudimos conectarnos. Revisá tu conexión e intentá de nuevo.");
      if (!result.ok) return setError(result.error);
      setCode("");
      setStep("code");
      setWait(RESEND_SECONDS);
    });
  }

  function verify(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    startTransition(async () => {
      const result = await verifyLoginCode(email, code, returnTo).catch(() => null);
      if (!result) return setError("No pudimos conectarnos. Revisá tu conexión e intentá de nuevo.");
      if (!result.ok) return setError(result.error);
      setLeaving(true);
      // Navegación completa: el encabezado y todo lo demás se arman con la sesión nueva.
      window.location.assign(result.redirectTo);
    });
  }

  return (
    <div className="flex flex-col gap-5">
      {step === "email" && (
        <>
          <GoogleSignInButton
            redirectTo="/mi-cuenta"
            text="continue_with"
            onError={setError}
            onSignedIn={async () => {
              const result = await completeSignIn(returnTo);
              return result.ok ? result.redirectTo : undefined;
            }}
          />

          <div className="flex items-center gap-3 text-sm text-muted-foreground" aria-hidden>
            <span className="h-px flex-1 bg-border" />o con tu email
            <span className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={send} noValidate className="flex flex-col gap-4">
            <Field id="login-email" label="Email" hint="Te mandamos un código para ingresar. Sin contraseñas.">
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                maxLength={254}
                required
              />
            </Field>
            <ErrorBox error={error} />
            <button type="submit" disabled={busy || !email.trim()} className={BUTTON}>
              {pending && <Loader2 aria-hidden className="size-4 animate-spin" />}
              Enviarme el código
            </button>
          </form>
        </>
      )}

      {step === "code" && (
        <form onSubmit={verify} noValidate className="flex flex-col gap-4">
          <div className="flex items-start gap-3 rounded-xl bg-muted/60 p-3.5 text-sm leading-relaxed" role="status">
            <MailCheck aria-hidden className="mt-0.5 size-5 shrink-0 text-brand" />
            <p>
              Te mandamos un código de 6 números a <span className="font-semibold break-all">{email.trim()}</span>.
              Vence en 10 minutos. Si no lo ves, revisá la carpeta de spam o promociones.
            </p>
          </div>

          <Field id="login-code" label="Código">
            <input
              ref={codeRef}
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              maxLength={6}
              placeholder="123456"
              className="text-center text-xl tracking-[0.4em] tabular-nums"
            />
          </Field>
          <ErrorBox error={error} />
          <button type="submit" disabled={busy || code.length !== 6} className={BUTTON}>
            {busy && <Loader2 aria-hidden className="size-4 animate-spin" />}
            {leaving ? "Ingresando…" : "Ingresar"}
          </button>

          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <button
              type="button"
              onClick={() => {
                setStep("email");
                setError(null);
              }}
              className="inline-flex items-center gap-1.5 font-medium underline-offset-4 hover:underline"
            >
              <ArrowLeft aria-hidden className="size-4" />
              Usar otro email
            </button>
            <button
              type="button"
              onClick={() => send()}
              disabled={busy || wait > 0}
              className="font-medium underline underline-offset-4 disabled:text-muted-foreground disabled:no-underline"
            >
              {wait > 0 ? `Reenviar código (${wait} s)` : "Reenviar código"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function ErrorBox({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p role="alert" className="flex gap-2 rounded-xl bg-brand-soft p-3 text-sm text-brand-hover">
      <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0" />
      {error}
    </p>
  );
}
