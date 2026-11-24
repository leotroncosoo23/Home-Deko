"use client";

import { useState } from "react";
import { Loader2, TicketPercent, X } from "lucide-react";
import { COUPON_CODE_MAX, normalizeCouponCode, type AppliedCoupon } from "@/lib/coupons";
import { cn } from "@/lib/utils";
import { ErrorText, STORE_CONTROL } from "../form-field";

/**
 * "¿Tenés un cupón?" dentro del resumen del checkout.
 *
 * Solo maneja el campo: aplicar, quitar y mostrar el error. El descuento lo
 * calcula el servidor (checkCoupon → coupon_quote en la base) y la fila del
 * descuento la dibuja el resumen.
 */
export function CouponField({
  applied,
  error,
  busy,
  onApply,
  onRemove,
}: {
  applied: AppliedCoupon | null;
  error: string | null;
  busy: boolean;
  onApply: (code: string) => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const showForm = !applied && (open || Boolean(error));

  if (applied) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl bg-muted/60 px-3 py-2.5 text-sm">
        <span className="flex min-w-0 items-center gap-2">
          <TicketPercent aria-hidden className="size-4 shrink-0 text-brand" />
          <span className="truncate">
            Cupón <span className="font-semibold">{applied.code}</span> aplicado
          </span>
        </span>
        <button
          type="button"
          onClick={() => {
            setCode("");
            onRemove();
          }}
          disabled={busy}
          className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-sm font-medium underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/20 focus-visible:outline-none"
        >
          <X aria-hidden className="size-3.5" />
          Quitar
        </button>
      </div>
    );
  }

  if (!showForm) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 self-start text-sm font-medium underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/20 focus-visible:outline-none"
      >
        <TicketPercent aria-hidden className="size-4 text-brand" />
        ¿Tenés un cupón?
      </button>
    );
  }

  function apply() {
    const clean = normalizeCouponCode(code);
    if (clean) onApply(clean);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="co-couponCode" className="text-sm font-medium">
        Cupón de descuento
      </label>
      <div className="flex gap-2">
        <input
          id="co-couponCode"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          // Enter aplica el cupón (y no envía el formulario de compra)
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              apply();
            }
          }}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={COUPON_CODE_MAX + 5}
          placeholder="Ej.: BIENVENIDA"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "co-couponCode-error" : undefined}
          className={cn(STORE_CONTROL, "uppercase placeholder:normal-case")}
        />
        <button
          type="button"
          onClick={apply}
          disabled={busy || !normalizeCouponCode(code)}
          className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-foreground px-4 text-sm font-semibold transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/20 focus-visible:outline-none disabled:opacity-50"
        >
          {busy && <Loader2 aria-hidden className="size-4 animate-spin" />}
          Aplicar
        </button>
      </div>
      {error && <ErrorText id="co-couponCode-error">{error}</ErrorText>}
    </div>
  );
}
