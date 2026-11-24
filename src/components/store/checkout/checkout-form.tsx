"use client";

import { cloneElement, useId, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { AlertCircle, Loader2, Lock, ShoppingBag, Store, Truck } from "lucide-react";
import { startCheckout } from "@/app/(tienda)/finalizar-compra/actions";
import { Checkbox } from "@/components/ui/checkbox";
import type { CartLine } from "@/lib/cart";
import {
  checkoutSchema,
  fieldErrorsFrom,
  PROVINCIAS,
  type CheckoutFieldErrors,
  type CheckoutFieldName,
} from "@/lib/checkout-schema";
import { formatARS } from "@/lib/format";
import { cn } from "@/lib/utils";
import { WhatsAppIcon } from "../whatsapp-icon";
import { getCartSnapshot } from "../cart/cart-store";
import {
  loadLastOrder,
  loadSavedCustomer,
  saveCustomer,
  saveLastOrder,
  type SavedCustomer,
} from "./checkout-storage";

/** Datos del local y contacto (de Configuración). */
export type StoreInfo = {
  storeAddress: string;
  storeHours: string;
  whatsappHref: string | null;
};

const FIELD_ORDER: CheckoutFieldName[] = [
  "name",
  "email",
  "phone",
  "delivery",
  "address",
  "city",
  "province",
  "postalCode",
  "acceptTerms",
];

const GENERIC_ERROR = "No pudimos iniciar el pago. Probá de nuevo en unos minutos o escribinos por WhatsApp.";

/** "$ 20.000" (sin ",00" cuando es redondo, como en el carrito). */
function shortARS(value: number): string {
  return formatARS(value).replace(/,00$/, "");
}

/**
 * Formulario de compra: tus datos, entrega y resumen con el botón de pago.
 *
 * Se monta recién en el navegador (CheckoutView lo muestra cuando ya leyó el
 * carrito), así que puede leer localStorage al iniciar sin problemas.
 *
 * Los totales que se ven acá son INFORMATIVOS: el que vale lo calcula la
 * base al crear el pedido (create_order) con los precios de ese momento.
 */
export function CheckoutForm({
  lines,
  shippingCost,
  store,
  onCartChanged,
}: {
  lines: CartLine[];
  shippingCost: number;
  store: StoreInfo;
  onCartChanged: () => void;
}) {
  const [values, setValues] = useState<SavedCustomer>(() => loadSavedCustomer());
  const [lastOrder] = useState(() => loadLastOrder());
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [errors, setErrors] = useState<CheckoutFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);
  const [pending, startTransition] = useTransition();
  const busy = pending || redirecting;

  function set<K extends keyof SavedCustomer>(key: K, value: SavedCustomer[K]) {
    setValues((v) => ({ ...v, [key]: value }));
    // Al corregir un campo, su error se va.
    if (errors[key as CheckoutFieldName]) setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function showErrors(fieldErrors: CheckoutFieldErrors, message: string) {
    setErrors(fieldErrors);
    setFormError(message);
    const first = FIELD_ORDER.find((f) => fieldErrors[f]);
    if (first) document.getElementById(`co-${first}`)?.focus();
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;

    const payload = { ...values, acceptTerms, items: getCartSnapshot() };
    // Primero en el navegador, para avisar rápido. El servidor valida otra vez.
    const parsed = checkoutSchema.safeParse(payload);
    if (!parsed.success) {
      showErrors(fieldErrorsFrom(parsed.error), "Revisá los datos marcados.");
      return;
    }
    setErrors({});
    setFormError(null);
    saveCustomer(values);

    startTransition(async () => {
      const result = await startCheckout(payload).catch(() => null);
      if (!result) {
        setFormError(GENERIC_ERROR);
        return;
      }
      if (result.ok) {
        // Por si vuelve de Mercado Pago con "atrás": queda el link al pedido.
        saveLastOrder(result.orderUrl);
        setRedirecting(true);
        window.location.assign(result.redirectUrl);
        return;
      }
      showErrors(result.fieldErrors ?? {}, result.error);
      if (result.cartChanged) onCartChanged();
    });
  }

  const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
  const shipping = values.delivery === "shipping" ? shippingCost : 0;
  const total = subtotal + shipping;

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      {lastOrder && (
        <p className="text-sm text-muted-foreground">
          ¿Ya pagaste?{" "}
          <Link href={lastOrder} className="font-semibold text-foreground underline underline-offset-4">
            Ver el estado de mi último pedido
          </Link>
        </p>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-10">
        <div className="flex flex-col gap-5">
          {/* ---- Tus datos ---- */}
          <Section title="Tus datos" description="Te mandamos la confirmación de la compra por email.">
            <Field id="co-name" label="Nombre y apellido" error={errors.name}>
              <input
                value={values.name}
                onChange={(e) => set("name", e.target.value)}
                autoComplete="name"
                maxLength={120}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="co-email" label="Email" error={errors.email}>
                <input
                  type="email"
                  inputMode="email"
                  value={values.email}
                  onChange={(e) => set("email", e.target.value)}
                  autoComplete="email"
                  maxLength={254}
                />
              </Field>
              <Field id="co-phone" label="Teléfono" hint="Con característica, por si necesitamos avisarte algo." error={errors.phone}>
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
          </Section>

          {/* ---- Entrega ---- */}
          <Section title="Entrega" description="Elegí cómo querés recibir tu compra.">
            <fieldset
              id="co-delivery"
              tabIndex={-1}
              aria-describedby={errors.delivery ? "co-delivery-error" : undefined}
              className="flex flex-col gap-3 outline-none"
            >
              <legend className="sr-only">Forma de entrega</legend>
              <DeliveryOption
                checked={values.delivery === "shipping"}
                onSelect={() => set("delivery", "shipping")}
                icon={<Truck aria-hidden className="size-5" />}
                title="Envío a domicilio"
                price={shortARS(shippingCost)}
                detail="A cualquier lugar del país. Te avisamos cuando lo despachemos, con el código de seguimiento."
              />
              <DeliveryOption
                checked={values.delivery === "pickup"}
                onSelect={() => set("delivery", "pickup")}
                icon={<Store aria-hidden className="size-5" />}
                title="Retiro en el local"
                price="Gratis"
                detail={
                  <>
                    {store.storeAddress}
                    {store.storeHours && <span className="mt-0.5 block">{store.storeHours}</span>}
                    <span className="mt-0.5 block">Te avisamos cuando esté listo para retirar.</span>
                  </>
                }
              />
              {errors.delivery && <ErrorText id="co-delivery-error">{errors.delivery}</ErrorText>}
            </fieldset>

            {values.delivery === "shipping" && (
              <div className="flex flex-col gap-4 border-t pt-4">
                <Field id="co-address" label="Dirección" hint="Calle, número y, si hay, piso o depto." error={errors.address}>
                  <input
                    value={values.address}
                    onChange={(e) => set("address", e.target.value)}
                    autoComplete="street-address"
                    maxLength={200}
                  />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field id="co-city" label="Ciudad o localidad" error={errors.city}>
                    <input
                      value={values.city}
                      onChange={(e) => set("city", e.target.value)}
                      autoComplete="address-level2"
                      maxLength={100}
                    />
                  </Field>
                  <Field id="co-province" label="Provincia" error={errors.province}>
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
                <Field id="co-postalCode" label="Código postal" className="sm:max-w-[calc(50%-0.5rem)]" error={errors.postalCode}>
                  <input
                    value={values.postalCode}
                    onChange={(e) => set("postalCode", e.target.value)}
                    autoComplete="postal-code"
                    maxLength={8}
                  />
                </Field>
              </div>
            )}
          </Section>
        </div>

        {/* ---- Resumen y pago ---- */}
        <aside className="flex flex-col gap-4 rounded-2xl border bg-background p-5 lg:sticky lg:top-24">
          <h2 className="font-display text-xl font-semibold">Tu pedido</h2>
          <ul className="flex flex-col divide-y">
            {lines.map((line) => (
              <SummaryLine key={line.variantId} line={line} />
            ))}
          </ul>

          <dl className="flex flex-col gap-2 border-t pt-4 text-[15px]">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd className="tabular-nums">{formatARS(subtotal)}</dd>
            </div>
            {/* Paso 7 (cupones): acá va la fila del descuento ("Cupón XXXX  − $ ...").
                El total ya está preparado en la base (discount_total). */}
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Envío</dt>
              <dd className="tabular-nums">
                {values.delivery === "shipping"
                  ? formatARS(shippingCost)
                  : values.delivery === "pickup"
                    ? "Gratis"
                    : <span className="text-muted-foreground">Elegí la entrega</span>}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 border-t pt-3">
              <dt className="text-base font-semibold">Total</dt>
              <dd className="text-xl font-semibold tabular-nums">{formatARS(total)}</dd>
            </div>
          </dl>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="co-acceptTerms" className="flex cursor-pointer items-start gap-3 text-sm leading-snug">
              <Checkbox
                id="co-acceptTerms"
                checked={acceptTerms}
                onCheckedChange={(checked) => {
                  setAcceptTerms(checked === true);
                  if (errors.acceptTerms) setErrors((er) => ({ ...er, acceptTerms: undefined }));
                }}
                aria-invalid={errors.acceptTerms ? true : undefined}
                aria-describedby={errors.acceptTerms ? "co-acceptTerms-error" : undefined}
                className="mt-0.5 size-5 data-checked:border-brand data-checked:bg-brand"
              />
              <span>
                Leí y acepto los{" "}
                <Link href="/terminos" target="_blank" className="font-medium underline underline-offset-4">
                  Términos y condiciones
                  <span className="sr-only"> (se abre en otra pestaña)</span>
                </Link>
                .
              </span>
            </label>
            {errors.acceptTerms && <ErrorText id="co-acceptTerms-error">{errors.acceptTerms}</ErrorText>}
          </div>

          {formError && (
            <p role="alert" className="flex gap-2 rounded-xl bg-brand-soft p-3 text-sm text-brand-hover">
              <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0" />
              {formError}
            </p>
          )}

          <button
            type="submit"
            disabled={busy || lines.length === 0}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-brand px-6 text-[15px] font-semibold text-white transition-colors hover:bg-brand-hover focus-visible:ring-3 focus-visible:ring-brand/30 focus-visible:outline-none disabled:opacity-70"
          >
            {busy && <Loader2 aria-hidden className="size-4 animate-spin" />}
            {redirecting ? "Te llevamos a Mercado Pago…" : pending ? "Preparando tu pago…" : "Pagar con Mercado Pago"}
          </button>
          <p className="flex gap-2 text-xs leading-relaxed text-muted-foreground">
            <Lock aria-hidden className="mt-0.5 size-3.5 shrink-0" />
            Pagás de forma segura en Mercado Pago, con tarjeta de crédito, débito o dinero en tu cuenta.
          </p>

          {store.whatsappHref && (
            <a
              href={store.whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 self-start text-sm font-medium underline-offset-4 hover:underline"
            >
              <WhatsAppIcon className="size-4 text-[#25D366]" />
              ¿Dudas? Escribinos por WhatsApp
              <span className="sr-only"> (se abre en otra pestaña)</span>
            </a>
          )}
        </aside>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl border p-5">
      <div>
        <h2 className="font-display text-xl font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}

const CONTROL =
  "h-11 w-full min-w-0 rounded-xl border border-input bg-background px-3.5 text-base outline-none transition-colors placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/15";

/** Campo con etiqueta, ayuda y error, conectados para lectores de pantalla. */
function Field({
  id,
  label,
  hint,
  error,
  className,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  className?: string;
  children: React.ReactElement<React.InputHTMLAttributes<HTMLElement>>;
}) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const control = cloneElement(children, {
    id,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": [hintId, errorId].filter(Boolean).join(" ") || undefined,
    className: CONTROL,
  });
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {control}
      {hint && !error && (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && <ErrorText id={errorId!}>{error}</ErrorText>}
    </div>
  );
}

function ErrorText({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <p id={id} className="text-sm text-destructive">
      {children}
    </p>
  );
}

function DeliveryOption({
  checked,
  onSelect,
  icon,
  title,
  price,
  detail,
}: {
  checked: boolean;
  onSelect: () => void;
  icon: React.ReactNode;
  title: string;
  price: string;
  detail: React.ReactNode;
}) {
  const id = useId();
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex cursor-pointer gap-3.5 rounded-xl border p-4 transition-colors has-focus-visible:ring-3 has-focus-visible:ring-ring/20",
        checked ? "border-brand bg-brand-soft/50" : "hover:bg-muted/50",
      )}
    >
      <input id={id} type="radio" name="delivery" checked={checked} onChange={onSelect} className="sr-only" />
      <span
        aria-hidden
        className={cn(
          "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2",
          checked ? "border-brand" : "border-input",
        )}
      >
        {checked && <span className="size-2.5 rounded-full bg-brand" />}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 font-semibold">
            <span className="text-brand">{icon}</span>
            {title}
          </span>
          <span className="font-semibold tabular-nums">{price}</span>
        </span>
        <span className="text-sm leading-relaxed text-muted-foreground">{detail}</span>
      </span>
    </label>
  );
}

function SummaryLine({ line }: { line: CartLine }) {
  return (
    <li className="flex gap-3 py-3 first:pt-0">
      <span className="relative size-16 shrink-0 overflow-hidden rounded-lg bg-muted">
        {line.imageUrl ? (
          <Image src={line.imageUrl} alt="" fill sizes="64px" className="object-cover" />
        ) : (
          <span className="flex h-full items-center justify-center">
            <ShoppingBag aria-hidden className="size-5 text-muted-foreground/40" />
          </span>
        )}
        <span className="absolute top-1 right-1 flex min-w-5 items-center justify-center rounded-full bg-foreground px-1 text-[11px] font-semibold text-background tabular-nums">
          {line.qty}
          <span className="sr-only"> unidades</span>
        </span>
      </span>
      <span className="flex min-w-0 flex-1 flex-col text-sm">
        <span className="line-clamp-2 font-medium">{line.name}</span>
        {line.variantLabel && <span className="text-muted-foreground">{line.variantLabel}</span>}
      </span>
      <span className="flex flex-col items-end text-sm tabular-nums">
        <span className={cn("font-semibold", line.unitPriceBefore && "text-brand")}>{formatARS(line.unitPrice * line.qty)}</span>
        {line.unitPriceBefore && (
          <span className="text-xs text-muted-foreground line-through">
            <span className="sr-only">Antes: </span>
            {formatARS(line.unitPriceBefore * line.qty)}
          </span>
        )}
      </span>
    </li>
  );
}
