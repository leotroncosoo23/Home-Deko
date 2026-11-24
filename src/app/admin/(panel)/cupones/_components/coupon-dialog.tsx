"use client";

import { useId, useState, useTransition } from "react";
import { Lock, Loader2, Percent, Shuffle, Truck, Banknote } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { couponFormSchema } from "@/lib/coupon-schema";
import { COUPON_CODE_MAX, couponSentence, normalizeCouponCode, type CouponKind } from "@/lib/coupons";
import { formatMoneyInput, parseInteger, parseMoney } from "@/lib/format";
import { saveCoupon } from "../actions";
import type { Coupon, CouponField } from "../types";

/**
 * Diálogo para crear (sin `coupon`) o editar (con `coupon`) un cupón.
 * El formulario se arma de cero cada vez que se abre.
 */
export function CouponDialog({
  open,
  onOpenChange,
  coupon,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  coupon?: Coupon;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{coupon ? `Editar cupón ${coupon.code}` : "Nuevo cupón"}</DialogTitle>
          <DialogDescription>
            {coupon
              ? "Los cambios valen para las compras que se hagan desde ahora."
              : "Tus clientes lo escriben al finalizar la compra y el descuento se aplica solo."}
          </DialogDescription>
        </DialogHeader>
        <CouponForm key={coupon?.id ?? "new"} coupon={coupon} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

const KIND_OPTIONS: { value: CouponKind; title: string; detail: string; icon: React.ReactNode }[] = [
  { value: "percent", title: "Porcentaje", detail: "Ej.: 10 % menos en los productos", icon: <Percent /> },
  { value: "fixed", title: "Monto fijo", detail: "Ej.: $ 5.000 menos en la compra", icon: <Banknote /> },
  { value: "free_shipping", title: "Envío gratis", detail: "Solo con envío a domicilio", icon: <Truck /> },
];

/** Código al azar fácil de dictar (sin 0/O ni 1/I). */
function randomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint32Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

function CouponForm({ coupon, onDone }: { coupon?: Coupon; onDone: () => void }) {
  const isEdit = Boolean(coupon);
  // Si ya se usó, el código y el tipo no se cambian (la base tampoco lo permite).
  const locked = coupon?.everUsed ?? false;
  const ids = useId();

  const [code, setCode] = useState(coupon?.code ?? "");
  const [kind, setKind] = useState<CouponKind>(coupon?.kind ?? "percent");
  const [value, setValue] = useState(
    coupon?.value == null ? "" : coupon.kind === "percent" ? String(coupon.value) : formatMoneyInput(coupon.value),
  );
  const [startsOn, setStartsOn] = useState(coupon?.startsOn ?? "");
  const [endsOn, setEndsOn] = useState(coupon?.endsOn ?? "");
  const [maxUses, setMaxUses] = useState(coupon?.maxUses ? String(coupon.maxUses) : "");
  const [minPurchase, setMinPurchase] = useState(coupon?.minPurchase ? formatMoneyInput(coupon.minPurchase) : "");
  const [onePerCustomer, setOnePerCustomer] = useState(coupon?.onePerCustomer ?? false);
  const [isActive, setIsActive] = useState(coupon?.isActive ?? true);
  const [errors, setErrors] = useState<Partial<Record<CouponField, string>>>({});
  const [pending, startTransition] = useTransition();

  function clearError(field: CouponField) {
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
  }

  // Vista previa en una frase (con lo que se pueda leer de lo escrito)
  const previewValue = kind === "percent" ? parseInteger(value) : kind === "fixed" ? parseMoney(value) : null;
  const previewMin = parseMoney(minPurchase);
  const previewMax = parseInteger(maxUses);
  const sentence = couponSentence({
    kind,
    value: previewValue && !Number.isNaN(previewValue) ? previewValue : null,
    minPurchase: previewMin && !Number.isNaN(previewMin) ? previewMin : null,
    startsOn: startsOn || null,
    endsOn: endsOn || null,
    maxUses: previewMax && !Number.isNaN(previewMax) ? previewMax : null,
    onePerCustomer,
  });

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const input = {
      id: coupon?.id,
      code,
      kind,
      value,
      startsOn,
      endsOn,
      maxUses,
      minPurchase,
      onePerCustomer,
      isActive,
    };
    // Validación rápida en el navegador (el servidor y la base validan de nuevo).
    const parsed = couponFormSchema.safeParse(input);
    if (!parsed.success) {
      const next: typeof errors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as CouponField | undefined;
        if (key && !next[key]) next[key] = issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});

    startTransition(async () => {
      try {
        const result = await saveCoupon(input);
        if (result.ok) {
          toast.success(isEdit ? "Cambios guardados" : `Cupón ${parsed.data.code} creado`);
          onDone();
        } else {
          setErrors(result.fieldErrors ?? {});
          if (!result.fieldErrors) toast.error(result.error);
        }
      } catch {
        toast.error("No se pudo guardar. Revisá tu conexión e intentá de nuevo.");
      }
    });
  }

  const errorText = (field: CouponField) =>
    errors[field] ? (
      <p id={`${ids}-${field}-error`} className="text-xs text-destructive">
        {errors[field]}
      </p>
    ) : null;
  const describedBy = (field: CouponField) => (errors[field] ? `${ids}-${field}-error` : undefined);

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
      {/* Así lo va a ver: una frase */}
      <p className="rounded-lg bg-muted/60 px-3 py-2.5 text-sm" aria-live="polite">
        <span className="font-semibold">{normalizeCouponCode(code) || "TUCODIGO"}</span>: {sentence}
      </p>

      {/* Código */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${ids}-code`}>Código</Label>
        <div className="flex gap-2">
          <Input
            id={`${ids}-code`}
            value={code}
            onChange={(e) => {
              setCode(normalizeCouponCode(e.target.value));
              clearError("code");
            }}
            placeholder="Ej.: BIENVENIDA"
            maxLength={COUPON_CODE_MAX}
            autoComplete="off"
            spellCheck={false}
            autoFocus={!isEdit}
            disabled={pending || locked}
            aria-invalid={Boolean(errors.code)}
            aria-describedby={describedBy("code") ?? `${ids}-code-help`}
            className="font-mono uppercase tracking-wide"
          />
          {!locked && (
            <Button type="button" variant="outline" onClick={() => setCode(randomCode())} disabled={pending}>
              <Shuffle /> Generar
            </Button>
          )}
        </div>
        {errorText("code") ?? (
          <p id={`${ids}-code-help`} className="flex gap-1.5 text-xs text-muted-foreground">
            {locked ? (
              <>
                <Lock className="mt-px size-3.5 shrink-0" aria-hidden />
                Este cupón ya se usó: el código y el tipo no se pueden cambiar.
              </>
            ) : (
              "Se guarda en mayúsculas y sin espacios. Letras, números o guiones."
            )}
          </p>
        )}
      </div>

      {/* Tipo */}
      <fieldset className="flex flex-col gap-1.5" disabled={pending || locked}>
        <legend className="mb-1.5 text-sm font-medium">Tipo de descuento</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {KIND_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={cn(
                "flex cursor-pointer flex-col gap-1 rounded-lg border p-3 text-sm transition-colors has-focus-visible:ring-3 has-focus-visible:ring-ring/20 has-disabled:cursor-not-allowed has-disabled:opacity-60",
                kind === opt.value ? "border-foreground bg-muted/50" : "hover:bg-muted/40",
              )}
            >
              <input
                type="radio"
                name={`${ids}-kind`}
                value={opt.value}
                checked={kind === opt.value}
                onChange={() => {
                  setKind(opt.value);
                  setValue("");
                  clearError("value");
                }}
                className="sr-only"
              />
              <span className="flex items-center gap-2 font-medium [&_svg]:size-4 [&_svg]:text-brand">
                {opt.icon}
                {opt.title}
              </span>
              <span className="text-xs text-muted-foreground">{opt.detail}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* Valor */}
      {kind !== "free_shipping" && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${ids}-value`}>{kind === "percent" ? "Porcentaje de descuento" : "Monto del descuento"}</Label>
          <Affix prefix={kind === "fixed" ? "$" : undefined} suffix={kind === "percent" ? "%" : undefined} invalid={Boolean(errors.value)}>
            <input
              id={`${ids}-value`}
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                clearError("value");
              }}
              inputMode={kind === "percent" ? "numeric" : "decimal"}
              placeholder={kind === "percent" ? "10" : "5.000"}
              autoComplete="off"
              disabled={pending}
              aria-invalid={Boolean(errors.value)}
              aria-describedby={describedBy("value") ?? `${ids}-value-help`}
              className="h-full min-w-0 flex-1 bg-transparent px-2.5 tabular-nums outline-none disabled:opacity-50"
            />
          </Affix>
          {errorText("value") ?? (
            <p id={`${ids}-value-help`} className="text-xs text-muted-foreground">
              Se descuenta de los productos (no del envío). Si un producto ya tiene un descuento mejor, se deja ese: nunca se suman.
            </p>
          )}
        </div>
      )}

      {/* Fechas */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${ids}-startsOn`}>
            Desde <span className="font-normal text-muted-foreground">(opcional)</span>
          </Label>
          <Input
            id={`${ids}-startsOn`}
            type="date"
            value={startsOn}
            onChange={(e) => {
              setStartsOn(e.target.value);
              clearError("startsOn");
            }}
            disabled={pending}
            aria-invalid={Boolean(errors.startsOn)}
            aria-describedby={describedBy("startsOn")}
          />
          {errorText("startsOn")}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${ids}-endsOn`}>
            Hasta <span className="font-normal text-muted-foreground">(opcional)</span>
          </Label>
          <Input
            id={`${ids}-endsOn`}
            type="date"
            value={endsOn}
            min={startsOn || undefined}
            onChange={(e) => {
              setEndsOn(e.target.value);
              clearError("endsOn");
            }}
            disabled={pending}
            aria-invalid={Boolean(errors.endsOn)}
            aria-describedby={describedBy("endsOn") ?? `${ids}-endsOn-help`}
          />
          {errorText("endsOn") ?? (
            <p id={`${ids}-endsOn-help`} className="text-xs text-muted-foreground">
              Vale hasta las 23:59 de ese día.
            </p>
          )}
        </div>
      </div>

      {/* Límites */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${ids}-maxUses`}>
            Usos máximos <span className="font-normal text-muted-foreground">(opcional)</span>
          </Label>
          <Input
            id={`${ids}-maxUses`}
            value={maxUses}
            onChange={(e) => {
              setMaxUses(e.target.value);
              clearError("maxUses");
            }}
            inputMode="numeric"
            placeholder="Sin límite"
            autoComplete="off"
            disabled={pending}
            aria-invalid={Boolean(errors.maxUses)}
            aria-describedby={describedBy("maxUses") ?? `${ids}-maxUses-help`}
            className="tabular-nums"
          />
          {errorText("maxUses") ?? (
            <p id={`${ids}-maxUses-help`} className="text-xs text-muted-foreground">
              Entre todos los clientes. Cuenta cuando se aprueba el pago.
            </p>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${ids}-minPurchase`}>
            Compra mínima <span className="font-normal text-muted-foreground">(opcional)</span>
          </Label>
          <Affix prefix="$" invalid={Boolean(errors.minPurchase)}>
            <input
              id={`${ids}-minPurchase`}
              value={minPurchase}
              onChange={(e) => {
                setMinPurchase(e.target.value);
                clearError("minPurchase");
              }}
              inputMode="decimal"
              placeholder="Sin mínimo"
              autoComplete="off"
              disabled={pending}
              aria-invalid={Boolean(errors.minPurchase)}
              aria-describedby={describedBy("minPurchase") ?? `${ids}-minPurchase-help`}
              className="h-full min-w-0 flex-1 bg-transparent px-2.5 tabular-nums outline-none disabled:opacity-50"
            />
          </Affix>
          {errorText("minPurchase") ?? (
            <p id={`${ids}-minPurchase-help`} className="text-xs text-muted-foreground">
              En productos, sin contar el envío.
            </p>
          )}
        </div>
      </div>

      {/* Interruptores */}
      <div className="flex flex-col divide-y rounded-lg border">
        <SwitchRow
          id={`${ids}-once`}
          label="Un uso por cliente"
          help="Cada email lo puede usar una sola vez. Ideal para cupones de bienvenida."
          checked={onePerCustomer}
          onChange={setOnePerCustomer}
          disabled={pending}
        />
        <SwitchRow
          id={`${ids}-active`}
          label="Activo"
          help="Si lo pausás, deja de funcionar en la tienda hasta que lo vuelvas a activar."
          checked={isActive}
          onChange={setIsActive}
          disabled={pending}
        />
      </div>

      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" disabled={pending} />}>Cancelar</DialogClose>
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}
          {pending ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear cupón"}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** Campo con "$" adelante o "%" atrás (mismo alto y foco que Input). */
function Affix({
  prefix,
  suffix,
  invalid,
  children,
}: {
  prefix?: string;
  suffix?: string;
  invalid: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex h-8 items-center overflow-hidden rounded-lg border border-input text-sm focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/20",
        invalid && "border-destructive ring-3 ring-destructive/20",
      )}
    >
      {prefix && <span className="flex h-full items-center border-r bg-muted px-2.5 text-muted-foreground">{prefix}</span>}
      {children}
      {suffix && <span className="flex h-full items-center border-l bg-muted px-2.5 text-muted-foreground">{suffix}</span>}
    </div>
  );
}

function SwitchRow({
  id,
  label,
  help,
  checked,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  help: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-3 py-2.5">
      <div className="flex flex-col gap-0.5">
        <Label htmlFor={id}>{label}</Label>
        <p className="text-xs text-muted-foreground">{help}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </div>
  );
}
