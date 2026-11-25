"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { AlertCircle, Check, CircleCheck, Copy, Loader2 } from "lucide-react";
import { submitWithdrawal } from "@/app/(tienda)/arrepentimiento/actions";
import {
  WITHDRAWAL_REASON_MAX,
  withdrawalFieldErrors,
  withdrawalSchema,
  type WithdrawalField,
  type WithdrawalFieldErrors,
  type WithdrawalInput,
} from "@/lib/withdrawal-schema";
import { Field } from "../form-field";

const EMPTY: WithdrawalInput = { fullName: "", email: "", orderNumber: "", reason: "" };

/**
 * Formulario del Botón de arrepentimiento: SIN cuenta ni pasos extra
 * (Disposición 954/2025). Al enviarlo muestra el código de la solicitud
 * (también le llega por email).
 */
export function WithdrawalForm() {
  const [values, setValues] = useState<WithdrawalInput>(EMPTY);
  const [errors, setErrors] = useState<WithdrawalFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState<{ code: string; email: string } | null>(null);
  const [pending, startTransition] = useTransition();
  // Campo trampa para robots (las personas no lo ven ni lo pueden enfocar).
  const [website, setWebsite] = useState("");

  function set(field: WithdrawalField, value: string) {
    setValues((v) => ({ ...v, [field]: value }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);

    const check = withdrawalSchema.safeParse(values);
    if (!check.success) {
      const fieldErrors = withdrawalFieldErrors(check.error);
      setErrors(fieldErrors);
      // Lleva el foco al primer campo con error.
      const first = (["fullName", "email", "orderNumber", "reason"] as const).find((f) => fieldErrors[f]);
      if (first) document.getElementById(`arr-${first}`)?.focus();
      return;
    }

    startTransition(async () => {
      try {
        const result = await submitWithdrawal({ ...values, website });
        if (result.ok) {
          setDone({ code: result.code, email: result.email });
        } else {
          setErrors(result.fieldErrors ?? {});
          setFormError(result.error);
        }
      } catch {
        setFormError("No pudimos enviar la solicitud. Revisá tu conexión e intentá de nuevo.");
      }
    });
  }

  if (done) return <WithdrawalDone code={done.code} email={done.email} />;

  return (
    <form onSubmit={handleSubmit} noValidate className="surface-card flex flex-col gap-5 p-5 sm:p-7">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold tracking-tight">Solicitá tu arrepentimiento</h2>
        <p className="text-sm text-muted-foreground">Solo necesitamos tu nombre y tu email. El resto es opcional.</p>
      </div>

      <Field id="arr-fullName" label="Nombre y apellido" error={errors.fullName}>
        <input
          value={values.fullName}
          onChange={(e) => set("fullName", e.target.value)}
          autoComplete="name"
          maxLength={120}
          disabled={pending}
        />
      </Field>
      <Field
        id="arr-email"
        label="Email"
        hint="El que usaste en la compra. Ahí te mandamos el código de tu solicitud."
        error={errors.email}
      >
        <input
          type="email"
          inputMode="email"
          value={values.email}
          onChange={(e) => set("email", e.target.value)}
          autoComplete="email"
          maxLength={254}
          disabled={pending}
        />
      </Field>
      <Field
        id="arr-orderNumber"
        label="Número de pedido (opcional)"
        hint="Está en el email de confirmación de tu compra (por ejemplo, 1024)."
        error={errors.orderNumber}
      >
        <input
          inputMode="numeric"
          value={values.orderNumber}
          onChange={(e) => set("orderNumber", e.target.value)}
          autoComplete="off"
          maxLength={14}
          placeholder="1024"
          disabled={pending}
          className="sm:max-w-48"
        />
      </Field>
      <Field id="arr-reason" label="Motivo (opcional)" hint="No hace falta que nos expliques nada." error={errors.reason}>
        <textarea
          value={values.reason}
          onChange={(e) => set("reason", e.target.value)}
          maxLength={WITHDRAWAL_REASON_MAX}
          rows={3}
          disabled={pending}
          className="h-auto min-h-24 py-3"
        />
      </Field>

      {/* Trampa para robots: fuera de la pantalla, sin foco ni lector de pantalla */}
      <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor="arr-website">No completar</label>
        <input
          id="arr-website"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
        />
      </div>

      {formError && (
        <p role="alert" className="flex gap-2 rounded-xl bg-brand-soft p-3 text-sm text-brand-hover">
          <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0" />
          {formError}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-brand px-6 text-[15px] font-semibold text-white transition-colors hover:bg-brand-hover focus-visible:ring-3 focus-visible:ring-brand/30 focus-visible:outline-none disabled:opacity-70 sm:self-start"
      >
        {pending && <Loader2 aria-hidden className="size-4 animate-spin" />}
        {pending ? "Enviando…" : "Enviar solicitud"}
      </button>
    </form>
  );
}

/** Confirmación con el código de la solicitud (Disp. 954/2025, art. 5). */
function WithdrawalDone({ code, email }: { code: string; email: string }) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [copied, setCopied] = useState(false);

  // Lleva el foco al mensaje: el lector de pantalla anuncia que salió bien.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Sin permiso para copiar: el código igual se ve en pantalla.
    }
  }

  return (
    <section className="surface-card flex flex-col items-center gap-4 p-6 text-center sm:p-8">
      <CircleCheck aria-hidden className="size-12 text-emerald-600" />
      <h2 ref={headingRef} tabIndex={-1} className="font-display text-2xl font-semibold outline-none">
        Recibimos tu solicitud
      </h2>
      <p className="text-[15px] text-muted-foreground">Este es el código de tu solicitud. Guardalo:</p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <span className="rounded-2xl bg-brand-soft px-5 py-3 font-mono text-2xl font-semibold tracking-[0.12em] text-brand tabular-nums">
          {code}
        </span>
        <button
          type="button"
          onClick={copy}
          className="inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/20 focus-visible:outline-none"
        >
          {copied ? <Check aria-hidden className="size-4 text-emerald-600" /> : <Copy aria-hidden className="size-4" />}
          {copied ? "Copiado" : "Copiar"}
        </button>
      </div>
      <p className="max-w-md text-[15px] leading-7 text-muted-foreground">
        También te lo mandamos a <span className="font-medium text-foreground">{email}</span> (si no lo ves, revisá
        spam). En breve te escribimos para coordinar la devolución, sin costo para vos.
      </p>
    </section>
  );
}
