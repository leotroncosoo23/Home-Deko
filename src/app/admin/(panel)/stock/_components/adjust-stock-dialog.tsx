"use client";

import { Suspense, use, useId, useState, useTransition } from "react";
import { ArrowRight, Loader2, Minus, Plus, Equal } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { parseInteger } from "@/lib/format";
import { adjustVariantStock, getProductVariantsForStock } from "../actions";
import { ADJUST_REASONS, type AdjustReason } from "../reasons";
import type { VariantStock } from "../types";

type Request = {
  productId: string;
  productName: string;
  variantId?: string;
  /** Pedido de las variantes con su stock ACTUAL (se dispara al abrir). */
  variants: Promise<VariantStock[]>;
};

/**
 * Hook para abrir "Ajustar stock" desde cualquier pantalla:
 *
 *   const adjust = useAdjustStockDialog();
 *   <button onClick={() => adjust.openFor(productId, "Taza", variantId)}>Ajustar</button>
 *   {adjust.dialog}
 *
 * Al abrir, pide a la base el stock ACTUAL de cada variante (no el que
 * quedó en pantalla), así la cuenta "actual → nuevo" es la real.
 */
export function useAdjustStockDialog() {
  const [request, setRequest] = useState<Request | null>(null);
  const [open, setOpen] = useState(false);

  function openFor(productId: string, productName: string, variantId?: string) {
    setRequest({ productId, productName, variantId, variants: getProductVariantsForStock(productId) });
    setOpen(true);
  }

  const dialog = (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ajustar stock</DialogTitle>
          <DialogDescription>{request?.productName}</DialogDescription>
        </DialogHeader>
        {request && (
          <Suspense fallback={<FormSkeleton />}>
            {/* key: si se abre para otro producto/variante, el formulario arranca limpio */}
            <AdjustForm
              key={`${request.productId}:${request.variantId ?? ""}`}
              request={request}
              onDone={() => setOpen(false)}
            />
          </Suspense>
        )}
      </DialogContent>
    </Dialog>
  );

  return { openFor, dialog };
}

function AdjustForm({ request, onDone }: { request: Request; onDone: () => void }) {
  const variants = use(request.variants);
  const ids = useId();
  const [variantId, setVariantId] = useState(
    request.variantId && variants.some((v) => v.variantId === request.variantId)
      ? request.variantId
      : (variants[0]?.variantId ?? ""),
  );
  const [reason, setReason] = useState<AdjustReason>("ingreso");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();

  if (variants.length === 0) {
    return (
      <p className="rounded-lg bg-muted px-3 py-3 text-sm text-muted-foreground">
        Este producto está archivado (o no tiene variantes activas). Desarchivalo para poder ajustar su stock.
      </p>
    );
  }

  const variant = variants.find((v) => v.variantId === variantId) ?? variants[0];
  const info = ADJUST_REASONS.find((r) => r.reason === reason)!;
  const qty = parseInteger(amount);
  const valid = qty !== null && !Number.isNaN(qty);
  const isCount = info.sign === 0;
  const newStock = !valid ? null : isCount ? qty : variant.stock + info.sign * qty;
  const negative = newStock !== null && newStock < 0;
  const noChange = valid && (isCount ? qty === variant.stock : qty === 0);
  const canSubmit = valid && !negative && !noChange && !pending;

  function submit() {
    if (!canSubmit || qty === null) return;
    startTransition(async () => {
      try {
        const result = await adjustVariantStock({
          variantId: variant.variantId,
          reason,
          amount: qty,
          note: note.trim() || null,
        });
        if (result.ok) {
          toast.success(result.message);
          onDone();
        } else {
          toast.error(result.error);
        }
      } catch {
        toast.error("No se pudo registrar el ajuste. Revisá tu conexión e intentá de nuevo.");
      }
    });
  }

  const variantItems = variants.map((v) => ({
    value: v.variantId,
    label: `${v.variantLabel ?? "Única"} — stock ${v.stock}`,
  }));

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      {/* Variante (solo si hay más de una) */}
      {variants.length > 1 && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${ids}-variant`}>Variante</Label>
          <Select items={variantItems} value={variant.variantId} onValueChange={(v) => v && setVariantId(String(v))}>
            <SelectTrigger id={`${ids}-variant`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {variantItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Motivo */}
      <div className="flex flex-col gap-1.5">
        <Label id={`${ids}-reason`}>Motivo</Label>
        <div role="radiogroup" aria-labelledby={`${ids}-reason`} className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {ADJUST_REASONS.map((r) => {
            const selected = r.reason === reason;
            const Icon = r.sign > 0 ? Plus : r.sign < 0 ? Minus : Equal;
            return (
              <button
                key={r.reason}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => {
                  setReason(r.reason);
                  setAmount("");
                }}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
                  selected ? "border-brand/50 bg-brand-soft/50 font-medium" : "hover:bg-muted/60",
                  r.reason === "ajuste" && "col-span-2 sm:col-span-1",
                )}
              >
                <span
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded-full",
                    selected ? "bg-brand text-white" : "bg-muted text-muted-foreground",
                  )}
                  aria-hidden
                >
                  <Icon className="size-3" />
                </span>
                {r.short}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">{info.label}</p>
      </div>

      {/* Cantidad o stock contado */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${ids}-amount`}>
          {isCount ? "Stock contado (lo que hay de verdad)" : info.sign > 0 ? "Cantidad que entra" : "Cantidad que sale"}
        </Label>
        <input
          id={`${ids}-amount`}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          autoFocus
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/\D/g, "").slice(0, 7))}
          placeholder={isCount ? String(variant.stock) : "0"}
          aria-invalid={negative || undefined}
          aria-describedby={`${ids}-preview`}
          className="h-10 w-full rounded-lg border border-input bg-background px-3 text-lg tabular-nums outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20"
        />
      </div>

      {/* Stock actual → nuevo */}
      <div
        id={`${ids}-preview`}
        aria-live="polite"
        className={cn(
          "flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg px-3 py-2.5 text-sm",
          negative ? "bg-destructive/5 text-destructive" : "bg-muted/70",
        )}
      >
        <span>
          Stock actual <span className="font-semibold tabular-nums">{variant.stock}</span>
        </span>
        <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
        <span>
          nuevo{" "}
          <span className="font-semibold tabular-nums">{newStock === null ? "—" : newStock}</span>
          {valid && isCount && !noChange && qty !== null && (
            <span className="ml-1.5 text-muted-foreground tabular-nums">
              ({qty - variant.stock > 0 ? "+" : ""}
              {qty - variant.stock})
            </span>
          )}
        </span>
        {negative && <span className="w-full text-xs">No hay tanto stock: quedan {variant.stock}.</span>}
        {noChange && isCount && <span className="w-full text-xs text-muted-foreground">Coincide con el stock actual: no hay nada que corregir.</span>}
      </div>

      {/* Nota */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${ids}-note`}>
          Nota <span className="font-normal text-muted-foreground">(opcional)</span>
        </Label>
        <Textarea
          id={`${ids}-note`}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          maxLength={300}
          placeholder={reason === "rotura" ? "Ej.: se cayó en la vidriera" : reason === "ingreso" ? "Ej.: remito 1234" : ""}
        />
      </div>

      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" disabled={pending} />}>Cancelar</DialogClose>
        <Button type="submit" disabled={!canSubmit}>
          {pending && <Loader2 className="animate-spin" />}
          Registrar
        </Button>
      </DialogFooter>
    </form>
  );
}

function FormSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy aria-label="Cargando el stock actual">
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
    </div>
  );
}
