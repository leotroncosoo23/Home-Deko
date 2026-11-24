"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { updateMyDetails } from "@/app/(tienda)/mi-cuenta/actions";
import {
  accountDetailsSchema,
  accountFieldErrorsFrom,
  type AccountDetails,
  type AccountFieldErrors,
  type AccountFieldName,
} from "@/lib/account-schema";
import { APARTMENT_MAX, NOTES_MAX, PROVINCIAS } from "@/lib/checkout-schema";
import { Field } from "../form-field";

const FIELD_ORDER: AccountFieldName[] = ["name", "phone", "address", "apartment", "city", "province", "postalCode", "notes"];

/**
 * "Mis datos": nombre, teléfono y la dirección de envío guardada (con piso
 * o depto e indicaciones). Se usan para completar el checkout solo.
 */
export function DetailsForm({ email, initial }: { email: string; initial: AccountDetails }) {
  const router = useRouter();
  const [values, setValues] = useState<AccountDetails>(initial);
  const [errors, setErrors] = useState<AccountFieldErrors>({});
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function set(key: AccountFieldName, value: string) {
    setValues((v) => ({ ...v, [key]: value }));
    setMessage(null);
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function showErrors(fieldErrors: AccountFieldErrors, text: string) {
    setErrors(fieldErrors);
    setMessage({ ok: false, text });
    const first = FIELD_ORDER.find((f) => fieldErrors[f]);
    if (first) document.getElementById(`acc-${first}`)?.focus();
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    const parsed = accountDetailsSchema.safeParse(values);
    if (!parsed.success) return showErrors(accountFieldErrorsFrom(parsed.error), "Revisá los datos marcados.");
    setErrors({});
    startTransition(async () => {
      const result = await updateMyDetails(values).catch(() => null);
      if (!result) return setMessage({ ok: false, text: "No pudimos conectarnos. Revisá tu conexión e intentá de nuevo." });
      if (!result.ok) return showErrors(result.fieldErrors ?? {}, result.error);
      setMessage({ ok: true, text: "¡Listo! Guardamos tus datos." });
      router.refresh(); // el saludo y el encabezado usan el nombre nuevo
    });
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <Field id="acc-name" label="Nombre y apellido" error={errors.name}>
        <input value={values.name} onChange={(e) => set("name", e.target.value)} autoComplete="name" maxLength={120} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Email</span>
          <p className="flex h-11 items-center rounded-xl bg-muted/60 px-3.5 text-base break-all text-muted-foreground">
            {email}
          </p>
        </div>
        <Field id="acc-phone" label="Teléfono" hint="Con característica." error={errors.phone}>
          <input
            type="tel"
            inputMode="tel"
            value={values.phone}
            onChange={(e) => set("phone", e.target.value)}
            autoComplete="tel"
            maxLength={25}
            placeholder="2945 123456"
          />
        </Field>
      </div>

      <fieldset className="flex flex-col gap-4 border-t pt-4">
        <legend className="pt-4 font-semibold">Dirección de envío</legend>
        <p className="-mt-2 text-sm text-muted-foreground">Opcional. La usamos para completar tus compras más rápido.</p>
        <div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <Field id="acc-address" label="Calle y número" error={errors.address}>
            <input
              value={values.address}
              onChange={(e) => set("address", e.target.value)}
              autoComplete="address-line1"
              maxLength={200}
            />
          </Field>
          <Field id="acc-apartment" label="Piso / Depto (opcional)" error={errors.apartment}>
            <input
              value={values.apartment}
              onChange={(e) => set("apartment", e.target.value)}
              autoComplete="address-line2"
              maxLength={APARTMENT_MAX}
              placeholder="Ej.: 2° B"
            />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="acc-city" label="Ciudad o localidad" error={errors.city}>
            <input
              value={values.city}
              onChange={(e) => set("city", e.target.value)}
              autoComplete="address-level2"
              maxLength={100}
            />
          </Field>
          <Field id="acc-province" label="Provincia" error={errors.province}>
            <select value={values.province} onChange={(e) => set("province", e.target.value)} autoComplete="address-level1">
              <option value="">Elegí una provincia</option>
              {PROVINCIAS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field id="acc-postalCode" label="Código postal" className="sm:max-w-[calc(50%-0.5rem)]" error={errors.postalCode}>
          <input
            value={values.postalCode}
            onChange={(e) => set("postalCode", e.target.value)}
            autoComplete="postal-code"
            maxLength={8}
          />
        </Field>
        <Field
          id="acc-notes"
          label="Indicaciones para la entrega (opcional)"
          hint={`Ej.: entre calles, timbre, color de la casa. Hasta ${NOTES_MAX} caracteres.`}
          error={errors.notes}
        >
          <input value={values.notes} onChange={(e) => set("notes", e.target.value)} autoComplete="off" maxLength={NOTES_MAX} />
        </Field>
      </fieldset>

      {message && (
        <p
          role={message.ok ? "status" : "alert"}
          className={
            message.ok
              ? "flex gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900"
              : "flex gap-2 rounded-xl bg-brand-soft p-3 text-sm text-brand-hover"
          }
        >
          {message.ok ? (
            <CheckCircle2 aria-hidden className="mt-0.5 size-4 shrink-0" />
          ) : (
            <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0" />
          )}
          {message.text}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-11 items-center justify-center gap-2 self-start rounded-full bg-foreground px-6 text-[15px] font-semibold text-background transition-colors hover:bg-foreground/90 focus-visible:ring-3 focus-visible:ring-ring/30 focus-visible:outline-none disabled:opacity-70"
      >
        {pending && <Loader2 aria-hidden className="size-4 animate-spin" />}
        Guardar mis datos
      </button>
    </form>
  );
}
