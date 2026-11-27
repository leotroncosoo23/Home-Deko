"use client";

import { useId, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { AlertCircle, Loader2, Lock, ShoppingBag, Store, Truck, UserRound } from "lucide-react";
import { checkCoupon, startCheckout } from "@/app/(tienda)/finalizar-compra/actions";
import { Checkbox } from "@/components/ui/checkbox";
import type { AccountDetails } from "@/lib/account-schema";
import type { CartLine } from "@/lib/cart";
import {
  checkoutSchemaFor,
  fieldErrorsFrom,
  APARTMENT_MAX,
  NOTES_MAX,
  PAYMENTS_UNAVAILABLE_MESSAGE,
  PROVINCIAS,
  type CheckoutFieldErrors,
  type CheckoutFieldName,
} from "@/lib/checkout-schema";
import type { AppliedCoupon } from "@/lib/coupons";
import { formatPrice } from "@/lib/format";
import { cartTotals, type PricingSettings } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import { linePrices, PriceBlock, totalPrices } from "../price-block";
import { CouponField } from "./coupon-field";
import { WhatsAppIcon } from "../whatsapp-icon";
import { ErrorText, Field } from "../form-field";
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
  /** Medio de pago activo (lo decide el servidor con PAYMENT_PROVIDER). */
  payment: CheckoutPayment;
};

/** Lo que el formulario necesita saber del medio de pago. */
export type CheckoutPayment = {
  /** false = faltan credenciales: no se puede pagar online (se ofrece WhatsApp). */
  available: boolean;
  /** Getnet: pide DNI y dirección de facturación. */
  requiresBilling: boolean;
  payButton: string;
  redirecting: string;
  secureNote: string;
};

/** La cuenta del cliente logueado (para completar el formulario solo). */
export type CheckoutAccount = { email: string; details: AccountDetails };

/**
 * Valores iniciales: con cuenta, sus datos; lo que la cuenta no tenga, de lo
 * guardado en este navegador. Sin cuenta, solo lo del navegador.
 */
function initialValues(account: CheckoutAccount | null): SavedCustomer {
  const saved = loadSavedCustomer();
  if (!account) return saved;
  const d = account.details;
  const billing = {
    dni: saved.dni,
    billingStreet: saved.billingStreet,
    billingNumber: saved.billingNumber,
    billingPostalCode: saved.billingPostalCode,
  };
  const pick = (fromAccount: string, fromBrowser: string) => fromAccount || fromBrowser;
  const hasAddress = Boolean(d.address);
  return {
    name: pick(d.name, saved.name),
    email: account.email || saved.email,
    phone: pick(d.phone, saved.phone),
    // Con una dirección guardada, se propone el envío (se puede cambiar).
    delivery: saved.delivery || (hasAddress ? "shipping" : ""),
    ...billing,
    // La dirección va entera de un lado o del otro (no mezclar dos direcciones).
    ...(hasAddress
      ? {
          address: d.address,
          apartment: d.apartment,
          city: d.city,
          province: d.province,
          postalCode: d.postalCode,
          notes: d.notes,
        }
      : {
          address: saved.address,
          apartment: saved.apartment,
          city: saved.city,
          province: saved.province,
          postalCode: saved.postalCode,
          notes: saved.notes,
        }),
  };
}

const FIELD_ORDER: CheckoutFieldName[] = [
  "name",
  "email",
  "phone",
  "dni",
  "delivery",
  "address",
  "apartment",
  "city",
  "province",
  "postalCode",
  "notes",
  "billingStreet",
  "billingNumber",
  "billingPostalCode",
  "acceptTerms",
];

const GENERIC_ERROR = "No pudimos iniciar el pago. Probá de nuevo en unos minutos o escribinos por WhatsApp.";

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
  pricing,
  store,
  account,
  onCartChanged,
}: {
  lines: CartLine[];
  shippingCost: number;
  /** Recargo de lista y cuotas (getCartLines). */
  pricing: PricingSettings;
  store: StoreInfo;
  /** null = compra como invitado. */
  account: CheckoutAccount | null;
  onCartChanged: () => void;
}) {
  const [values, setValues] = useState<SavedCustomer>(() => initialValues(account));
  const [lastOrder] = useState(() => loadLastOrder());
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [saveToAccount, setSaveToAccount] = useState(true);
  const [errors, setErrors] = useState<CheckoutFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);
  // El servidor puede avisar que los pagos no están disponibles aunque la
  // página se haya cargado antes con el pago activo.
  const [unavailable, setUnavailable] = useState(!store.payment.available);
  const payment = store.payment;
  const [pending, startTransition] = useTransition();
  const busy = pending || redirecting;
  // Cupón: el descuento lo calcula SIEMPRE el servidor (checkCoupon). Acá
  // solo se guarda lo que respondió, para mostrarlo en el resumen.
  const [coupon, setCoupon] = useState<AppliedCoupon | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponBusy, setCouponBusy] = useState(false);

  async function runCouponCheck(code: string, delivery: SavedCustomer["delivery"]) {
    setCouponBusy(true);
    const result = await checkCoupon({
      code,
      items: getCartSnapshot(),
      delivery: delivery || undefined,
      email: values.email,
    }).catch(() => null);
    setCouponBusy(false);
    if (!result) {
      setCouponError("No pudimos revisar el cupón. Probá de nuevo en unos minutos.");
      return;
    }
    if (result.ok) {
      setCoupon({ code: result.code, kind: result.kind, discount: result.discount });
      setCouponError(null);
    } else {
      setCoupon(null);
      setCouponError(result.error);
    }
  }

  /** Al cambiar la entrega, el cupón se vuelve a revisar (el envío gratis depende de eso). */
  function selectDelivery(delivery: "shipping" | "pickup") {
    set("delivery", delivery);
    if (coupon && delivery !== values.delivery) void runCouponCheck(coupon.code, delivery);
  }

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

    const payload = {
      ...values,
      acceptTerms,
      saveToAccount: Boolean(account) && saveToAccount,
      couponCode: coupon?.code ?? "",
      items: getCartSnapshot(),
    };
    // Primero en el navegador, para avisar rápido. El servidor valida otra vez.
    const parsed = checkoutSchemaFor(payment.requiresBilling).safeParse(payload);
    if (!parsed.success) {
      showErrors(fieldErrorsFrom(parsed.error), "Revisá los datos marcados.");
      return;
    }
    setErrors({});
    setFormError(null);
    // Con cuenta, los datos viven en la cuenta: no se dejan en este navegador
    // (por ejemplo, si es una compu compartida).
    if (!account) saveCustomer(values);

    startTransition(async () => {
      const result = await startCheckout(payload).catch(() => null);
      if (!result) {
        setFormError(GENERIC_ERROR);
        return;
      }
      if (result.ok) {
        // Por si vuelve de la página de pago con "atrás": queda el link al pedido.
        saveLastOrder(result.orderUrl);
        setRedirecting(true);
        window.location.assign(result.redirectUrl);
        return;
      }
      if (result.paymentsUnavailable) {
        setUnavailable(true);
        setFormError(null);
        return;
      }
      if (result.couponError) {
        // El cupón dejó de valer: se quita, y el motivo queda junto al campo.
        setCoupon(null);
        setCouponError(result.couponError);
        showErrors(result.fieldErrors ?? {}, "No pudimos usar tu cupón: lo quitamos. Revisá el total y volvé a intentar.");
        return;
      }
      showErrors(result.fieldErrors ?? {}, result.error);
      if (result.cartChanged) {
        onCartChanged();
        // Con otro carrito, el descuento puede cambiar: que lo vuelva a aplicar.
        if (coupon) {
          setCoupon(null);
          setCouponError("Como cambió tu carrito, volvé a aplicar el cupón.");
        }
      }
    });
  }

  const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
  const shipping = values.delivery === "shipping" ? shippingCost : 0;
  // Envío gratis: el descuento es el envío (solo con envío a domicilio).
  const freeShipping = coupon?.kind === "free_shipping" && values.delivery === "shipping";
  const discount = coupon ? (coupon.kind === "free_shipping" ? (freeShipping ? shipping : 0) : coupon.discount) : 0;
  const total = Math.max(subtotal - discount + shipping, 0);
  // "o $ … en N cuotas": lista de los productos + envío (src/lib/pricing.ts).
  // Con un cupón de productos no se muestra: el cupón es para el pago en 1 pago.
  const installments =
    coupon && coupon.kind !== "free_shipping"
      ? null
      : cartTotals(
          lines.map((l) => ({ price: l.unitPriceBefore ?? l.unitPrice, finalPrice: l.unitPrice, qty: l.qty })),
          pricing,
          freeShipping ? 0 : shipping,
        );

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
            {account ? (
              <p className="flex items-start gap-2.5 rounded-xl bg-muted/60 p-3 text-sm">
                <UserRound aria-hidden className="mt-0.5 size-4 shrink-0 text-brand" />
                <span>
                  Comprás con tu cuenta <span className="font-medium break-all">{account.email}</span>. Completamos tus
                  datos guardados: revisalos antes de pagar.
                </span>
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                ¿Tenés cuenta?{" "}
                <Link
                  href="/mi-cuenta?volver=/finalizar-compra"
                  className="font-semibold text-foreground underline underline-offset-4"
                >
                  Ingresá y completamos tus datos
                </Link>
              </p>
            )}
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
            {payment.requiresBilling && (
              <Field
                id="co-dni"
                label="DNI"
                hint="Lo pide el procesador de pagos para validar la tarjeta."
                className="sm:max-w-[calc(50%-0.5rem)]"
                error={errors.dni}
              >
                <input
                  inputMode="numeric"
                  value={values.dni}
                  onChange={(e) => set("dni", e.target.value)}
                  autoComplete="off"
                  maxLength={12}
                  placeholder="Sin puntos"
                />
              </Field>
            )}
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
                onSelect={() => selectDelivery("shipping")}
                icon={<Truck aria-hidden className="size-5" />}
                title="Envío a domicilio"
                price={formatPrice(shippingCost)}
                detail="A cualquier lugar del país. Te avisamos cuando lo despachemos, con el código de seguimiento."
              />
              <DeliveryOption
                checked={values.delivery === "pickup"}
                onSelect={() => selectDelivery("pickup")}
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
                <div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                  <Field id="co-address" label="Calle y número" error={errors.address}>
                    <input
                      value={values.address}
                      onChange={(e) => set("address", e.target.value)}
                      autoComplete="address-line1"
                      maxLength={200}
                    />
                  </Field>
                  <Field id="co-apartment" label="Piso / Depto (opcional)" error={errors.apartment}>
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
                <Field
                  id="co-notes"
                  label="Indicaciones para la entrega (opcional)"
                  hint={`Ej.: entre calles, timbre, color de la casa. Hasta ${NOTES_MAX} caracteres.`}
                  error={errors.notes}
                >
                  <input
                    value={values.notes}
                    onChange={(e) => set("notes", e.target.value)}
                    autoComplete="off"
                    maxLength={NOTES_MAX}
                  />
                </Field>
              </div>
            )}
          </Section>

          {/* ---- Facturación (Getnet la pide) ---- */}
          {payment.requiresBilling && values.delivery === "shipping" && (
            <p className="px-1 text-sm text-muted-foreground">
              Para el pago usamos tu dirección de envío como dirección de facturación.
            </p>
          )}
          {payment.requiresBilling && values.delivery === "pickup" && (
            <Section title="Dirección de facturación" description="La de tu tarjeta o tu domicilio. La pide el procesador de pagos.">
              <div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                <Field id="co-billingStreet" label="Calle" error={errors.billingStreet}>
                  <input
                    value={values.billingStreet}
                    onChange={(e) => set("billingStreet", e.target.value)}
                    autoComplete="billing address-line1"
                    maxLength={200}
                  />
                </Field>
                <Field id="co-billingNumber" label="Número" hint="Si no tiene, poné S/N." error={errors.billingNumber}>
                  <input
                    value={values.billingNumber}
                    onChange={(e) => set("billingNumber", e.target.value)}
                    autoComplete="off"
                    maxLength={20}
                  />
                </Field>
              </div>
              <Field
                id="co-billingPostalCode"
                label="Código postal"
                className="sm:max-w-[calc(50%-0.5rem)]"
                error={errors.billingPostalCode}
              >
                <input
                  value={values.billingPostalCode}
                  onChange={(e) => set("billingPostalCode", e.target.value)}
                  autoComplete="billing postal-code"
                  maxLength={8}
                />
              </Field>
            </Section>
          )}

          {account && (
            <label htmlFor="co-saveToAccount" className="flex cursor-pointer items-start gap-3 px-1 text-sm leading-snug">
              <Checkbox
                id="co-saveToAccount"
                checked={saveToAccount}
                onCheckedChange={(checked) => setSaveToAccount(checked === true)}
                className="mt-0.5 size-5 data-checked:border-brand data-checked:bg-brand"
              />
              <span>
                Guardar estos datos en mi cuenta
                <span className="block text-muted-foreground">Así la próxima compra es más rápida.</span>
              </span>
            </label>
          )}
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
              <dd className="tabular-nums">{formatPrice(subtotal)}</dd>
            </div>
            {/* Descuento del cupón (productos). El de envío gratis se ve en la fila del envío. */}
            {coupon && coupon.kind !== "free_shipping" && discount > 0 && (
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Cupón {coupon.code}</dt>
                <dd className="font-medium text-brand tabular-nums">− {formatPrice(discount)}</dd>
              </div>
            )}
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">
                Envío{freeShipping && <span className="block text-xs">Cupón {coupon?.code}</span>}
              </dt>
              <dd className="tabular-nums">
                {freeShipping ? (
                  <span className="flex flex-col items-end">
                    <span className="font-medium text-brand">Gratis</span>
                    <span className="text-xs text-muted-foreground line-through">
                      <span className="sr-only">Antes: </span>
                      {formatPrice(shippingCost)}
                    </span>
                  </span>
                ) : values.delivery === "shipping" ? (
                  formatPrice(shippingCost)
                ) : values.delivery === "pickup" ? (
                  "Gratis"
                ) : (
                  <span className="text-muted-foreground">Elegí la entrega</span>
                )}
              </dd>
            </div>
            {coupon?.kind === "free_shipping" && values.delivery !== "shipping" && (
              <p className="text-xs text-muted-foreground">
                Tu cupón {coupon.code} es de envío gratis: se aplica al elegir envío a domicilio.
              </p>
            )}
            <div className="flex items-baseline justify-between gap-4 border-t pt-3">
              <dt className="text-base font-semibold">Total</dt>
              <dd className="text-xl font-semibold tabular-nums">{formatPrice(total)}</dd>
            </div>
            {installments && (
              <PriceBlock variant="total" prices={totalPrices(installments)} pricing={pricing} className="-mt-1 text-right" />
            )}
          </dl>

          <CouponField
            applied={coupon}
            error={couponError}
            busy={couponBusy || busy}
            onApply={(code) => void runCouponCheck(code, values.delivery)}
            onRemove={() => {
              setCoupon(null);
              setCouponError(null);
            }}
          />

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

          {unavailable ? (
            <div role="status" className="flex flex-col gap-3 rounded-xl bg-muted/60 p-4 text-sm">
              <p className="flex gap-2">
                <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0 text-brand" />
                {PAYMENTS_UNAVAILABLE_MESSAGE}
              </p>
              {store.whatsappHref && (
                <a
                  href={store.whatsappHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#25D366] px-5 font-semibold text-white"
                >
                  <WhatsAppIcon className="size-4" />
                  Escribinos por WhatsApp
                  <span className="sr-only"> (se abre en otra pestaña)</span>
                </a>
              )}
            </div>
          ) : (
            <>
              <button
                type="submit"
                disabled={busy || lines.length === 0}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-brand px-6 text-[15px] font-semibold text-white transition-colors hover:bg-brand-hover focus-visible:ring-3 focus-visible:ring-brand/30 focus-visible:outline-none disabled:opacity-70"
              >
                {busy && <Loader2 aria-hidden className="size-4 animate-spin" />}
                {redirecting ? payment.redirecting : pending ? "Preparando tu pago…" : payment.payButton}
              </button>
              <p className="flex gap-2 text-xs leading-relaxed text-muted-foreground">
                <Lock aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                {payment.secureNote}
              </p>
            </>
          )}

          {store.whatsappHref && !unavailable && (
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
      <PriceBlock variant="cart" prices={linePrices(line)} qty={line.qty} className="text-sm" />
    </li>
  );
}
