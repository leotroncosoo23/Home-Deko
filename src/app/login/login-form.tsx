"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, CheckCircle2, Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { GoogleIcon } from "@/components/auth/google-icon";
import {
  signInWithGoogle,
  signInWithPassword,
  signUp,
  type AuthFormState,
} from "./actions";

type Mode = "login" | "signup";

const initialState: AuthFormState = {};

export function LoginForm({ next, initialError }: { next: string; initialError?: string }) {
  const [mode, setMode] = useState<Mode>("login");
  const [showPassword, setShowPassword] = useState(false);

  // useActionState: llama a la Server Action y nos devuelve lo que respondió
  // (error o mensaje de éxito) + si está procesando.
  const [loginState, loginAction] = useActionState(signInWithPassword, initialState);
  const [signupState, signupAction] = useActionState(signUp, initialState);

  const state = mode === "login" ? loginState : signupState;
  const error = state.error ?? (mode === "login" && !loginState.email ? initialError : undefined);

  return (
    <div className="flex flex-col gap-5">
      {/* ---------- Google ---------- */}
      <form action={signInWithGoogle}>
        <input type="hidden" name="next" value={next} />
        <GoogleButton />
      </form>

      {/* ---------- Separador "o" ---------- */}
      <div className="flex items-center gap-3">
        <Separator className="flex-1" />
        <span className="text-xs text-muted-foreground">o</span>
        <Separator className="flex-1" />
      </div>

      {/* ---------- Email y contraseña ---------- */}
      {state.success ? (
        <Notice tone="success">{state.success}</Notice>
      ) : (
        <form
          // key: al cambiar de modo, el formulario se "resetea"
          key={mode}
          action={mode === "login" ? loginAction : signupAction}
          className="flex flex-col gap-4"
          noValidate
        >
          <input type="hidden" name="next" value={next} />

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder="nombre@ejemplo.com"
              defaultValue={state.email}
              required
              aria-invalid={Boolean(error) || undefined}
              className="h-10"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Contraseña</Label>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                required
                minLength={mode === "signup" ? 8 : undefined}
                aria-invalid={Boolean(error) || undefined}
                className="h-10 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-lg text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            {mode === "signup" && (
              <p className="text-xs text-muted-foreground">Mínimo 8 caracteres.</p>
            )}
          </div>

          {error && <Notice tone="error">{error}</Notice>}

          <SubmitButton mode={mode} />
        </form>
      )}

      {/* ---------- Cambiar entre ingresar / crear cuenta ---------- */}
      <p className="text-center text-sm text-muted-foreground">
        {mode === "login" ? "¿No tenés cuenta?" : "¿Ya tenés cuenta?"}{" "}
        <button
          type="button"
          onClick={() => setMode(mode === "login" ? "signup" : "login")}
          className="font-medium text-foreground underline-offset-4 hover:underline focus-visible:underline"
        >
          {mode === "login" ? "Crear cuenta" : "Ingresar"}
        </button>
      </p>
    </div>
  );
}

function GoogleButton() {
  // useFormStatus: sabe si el <form> que lo contiene se está enviando
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="outline" size="lg" disabled={pending} className="h-10 w-full">
      {pending ? <Loader2 className="animate-spin" /> : <GoogleIcon className="size-4" />}
      Continuar con Google
    </Button>
  );
}

function SubmitButton({ mode }: { mode: Mode }) {
  const { pending } = useFormStatus();
  const label = mode === "login" ? "Ingresar" : "Crear cuenta";
  return (
    <Button type="submit" size="lg" disabled={pending} className="h-10 w-full">
      {pending && <Loader2 className="animate-spin" />}
      {pending ? (mode === "login" ? "Ingresando…" : "Creando cuenta…") : label}
    </Button>
  );
}

function Notice({ tone, children }: { tone: "error" | "success"; children: React.ReactNode }) {
  const Icon = tone === "error" ? AlertCircle : CheckCircle2;
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={
        tone === "error"
          ? "flex gap-2 rounded-lg bg-brand-soft px-3 py-2.5 text-sm text-brand-hover"
          : "flex gap-2 rounded-lg bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800"
      }
    >
      <Icon className="mt-0.5 size-4 shrink-0" />
      <p>{children}</p>
    </div>
  );
}
