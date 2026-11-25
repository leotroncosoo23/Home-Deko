"use client";

import { useState, useTransition } from "react";
import { Building2, Loader2, Share2, Truck } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { SectionCard } from "@/components/admin/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatCuit, formatMoneyInput } from "@/lib/format";
import { useUnsavedWarning } from "../../productos/_components/use-unsaved-warning";
import { saveStoreSettings } from "../actions";
import { SETTINGS_FIELDS, validateSettings, type SettingsField, type SettingsInput } from "../schema";
import type { AdminSettings } from "../types";

/** Datos guardados → texto de cada campo. */
function toInput(s: AdminSettings): SettingsInput {
  return {
    whatsapp: s.whatsapp,
    instagram: s.instagram,
    tiktok: s.tiktok,
    shippingCost: formatMoneyInput(s.shippingCost),
    dispatchTime: s.dispatchTime,
    storeAddress: s.storeAddress,
    storeHours: s.storeHours,
    exchangeDays: String(s.exchangeDays),
    businessName: s.businessName,
    cuit: formatCuit(s.cuit),
    contactEmail: s.contactEmail,
  };
}

/**
 * Formulario de Configuración: tres tarjetas y un solo "Guardar cambios".
 *
 * La página lo monta con una `key` armada con los datos guardados: después
 * de guardar, el servidor devuelve los datos limpios (ej.: "@usuario" →
 * "usuario") y el formulario arranca de nuevo con ellos, sin cambios pendientes.
 */
export function SettingsForm({ settings }: { settings: AdminSettings }) {
  // ids fijos ("config-whatsapp"…): el aviso de "Estado de la tienda" lleva
  // hasta cada campo que falta (ver settingsFieldId en schema.ts).
  const ids = "config";
  const [initial] = useState(() => toInput(settings));
  const [values, setValues] = useState<SettingsInput>(initial);
  const [errors, setErrors] = useState<Partial<Record<SettingsField, string>>>({});
  const [pending, startTransition] = useTransition();

  const dirty = SETTINGS_FIELDS.some((f) => values[f] !== initial[f]);
  const { allowLeave } = useUnsavedWarning(dirty);

  function set(field: SettingsField, value: string) {
    setValues((v) => ({ ...v, [field]: value }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    // Validación rápida en el navegador (el servidor valida de nuevo).
    const check = validateSettings(values, { isLaunched: settings.isLaunched });
    if (!check.ok) {
      setErrors(check.fieldErrors);
      toast.error("Revisá los datos marcados.");
      return;
    }

    const formData = new FormData();
    SETTINGS_FIELDS.forEach((f) => formData.set(f, values[f]));

    startTransition(async () => {
      try {
        const result = await saveStoreSettings(formData);
        if (result.ok) {
          allowLeave();
          toast.success("Cambios guardados");
        } else {
          setErrors(result.fieldErrors ?? {});
          toast.error(result.error);
        }
      } catch {
        toast.error("No se pudo guardar. Revisá tu conexión e intentá de nuevo.");
      }
    });
  }

  /** Props comunes de cada campo: id, valor, error y ayuda accesibles. */
  function fieldProps(field: SettingsField) {
    return {
      id: `${ids}-${field}`,
      value: values[field],
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(field, e.target.value),
      disabled: pending,
      "aria-invalid": Boolean(errors[field]),
      "aria-describedby": `${ids}-${field}-help`,
    };
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
      {/* ---------- Redes y contacto ---------- */}
      <SectionCard
        icon={Share2}
        title="Redes y contacto"
        description="Aparecen en la página «Muy pronto», en el pie de la tienda y en el botón de WhatsApp."
        contentClassName="grid gap-5 sm:grid-cols-2"
      >
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor={`${ids}-whatsapp`}>WhatsApp</Label>
          <Input {...fieldProps("whatsapp")} inputMode="tel" placeholder="5492945123456" autoComplete="off" />
          <FieldHelp id={`${ids}-whatsapp-help`} error={errors.whatsapp}>
            Con código de país y sin el 0 ni el 15: 54 + 9 + código de área + número (ej.: 5492945123456).
          </FieldHelp>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${ids}-instagram`}>Instagram</Label>
          <Input {...fieldProps("instagram")} placeholder="homedeko.hogar" autoComplete="off" spellCheck={false} />
          <FieldHelp id={`${ids}-instagram-help`} error={errors.instagram}>El usuario, sin @ (también podés pegar el link del perfil).</FieldHelp>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${ids}-tiktok`}>TikTok</Label>
          <Input {...fieldProps("tiktok")} placeholder="homedeko" autoComplete="off" spellCheck={false} />
          <FieldHelp id={`${ids}-tiktok-help`} error={errors.tiktok}>El usuario, sin @. Si lo dejás vacío, no se muestra.</FieldHelp>
        </div>
      </SectionCard>

      {/* ---------- Envío y retiro ---------- */}
      <SectionCard
        icon={Truck}
        title="Envío, retiro y cambios"
        description="El costo del envío, los datos del local para quien retira y el plazo para cambios."
        contentClassName="grid gap-5"
      >
        <div className="flex flex-col gap-1.5 sm:max-w-60">
          <Label htmlFor={`${ids}-shippingCost`}>Costo del envío a domicilio</Label>
          <div
            className={cn(
              "flex h-8 items-center overflow-hidden rounded-lg border border-input text-sm focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/20",
              errors.shippingCost && "border-destructive ring-3 ring-destructive/20",
            )}
          >
            <span className="flex h-full items-center border-r bg-muted px-2.5 text-muted-foreground">$</span>
            <input
              {...fieldProps("shippingCost")}
              inputMode="decimal"
              placeholder="20.000"
              autoComplete="off"
              className="h-full min-w-0 flex-1 bg-transparent px-2.5 tabular-nums outline-none disabled:opacity-50"
            />
          </div>
          <FieldHelp id={`${ids}-shippingCost-help`} error={errors.shippingCost}>Precio fijo, a cualquier lugar del país.</FieldHelp>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${ids}-dispatchTime`}>Plazo de despacho</Label>
          <Input {...fieldProps("dispatchTime")} maxLength={60} placeholder="24 a 48 h hábiles" className="sm:max-w-80" />
          <FieldHelp id={`${ids}-dispatchTime-help`} error={errors.dispatchTime}>
            Cuánto tardan en despachar un pedido pagado. Se lee como «Despachamos tu pedido en 24 a 48 h hábiles»
            en la tienda y en el mail de pago confirmado. Si lo dejás vacío, no se menciona.
          </FieldHelp>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${ids}-storeAddress`}>Dirección del local</Label>
          <Input {...fieldProps("storeAddress")} maxLength={200} placeholder="Av. San Martín 677, Trevelin, Chubut, Argentina" />
          <FieldHelp id={`${ids}-storeAddress-help`} error={errors.storeAddress}>Para el retiro en el local, el pie de página y las páginas legales.</FieldHelp>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${ids}-storeHours`}>Horarios del local</Label>
          <Textarea
            {...fieldProps("storeHours")}
            maxLength={300}
            rows={2}
            placeholder="Lunes a sábado de 9 a 13 y de 16 a 20"
          />
          <FieldHelp id={`${ids}-storeHours-help`} error={errors.storeHours}>Se muestran a quien elige retirar su compra en el local.</FieldHelp>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${ids}-exchangeDays`}>Cambios por gusto: plazo en días</Label>
          <div
            className={cn(
              "flex h-8 items-center overflow-hidden rounded-lg border border-input text-sm focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/20 sm:max-w-60",
              errors.exchangeDays && "border-destructive ring-3 ring-destructive/20",
            )}
          >
            <input
              {...fieldProps("exchangeDays")}
              inputMode="numeric"
              placeholder="30"
              autoComplete="off"
              className="h-full min-w-0 flex-1 bg-transparent px-2.5 tabular-nums outline-none disabled:opacity-50"
            />
            <span className="flex h-full items-center border-l bg-muted px-2.5 text-muted-foreground">días</span>
          </div>
          {/* Explica lo que es obligatorio por ley */}
          <FieldHelp id={`${ids}-exchangeDays-help`} error={errors.exchangeDays}>
            Para cambiar un producto sin falla (no le gustó el color, la medida…). Poné 0 si no aceptan
            cambios por gusto. El arrepentimiento de 10 días y la garantía por productos fallados van
            siempre en los Términos: son obligatorios por ley.
          </FieldHelp>
        </div>
      </SectionCard>

      {/* ---------- Datos del comercio ---------- */}
      <SectionCard
        icon={Building2}
        title="Datos del comercio"
        description="Van en el pie de la tienda y en las páginas legales (son obligatorios para vender online)."
        contentClassName="grid gap-5 sm:grid-cols-2"
      >
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor={`${ids}-businessName`}>Nombre o razón social</Label>
          <Input {...fieldProps("businessName")} maxLength={120} placeholder="Como figura en ARCA" />
          <FieldHelp id={`${ids}-businessName-help`} error={errors.businessName}>El nombre del titular o de la empresa, como figura en ARCA (ex AFIP).</FieldHelp>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${ids}-cuit`}>CUIT</Label>
          <Input {...fieldProps("cuit")} inputMode="numeric" placeholder="20-12345678-6" autoComplete="off" className="tabular-nums" />
          <FieldHelp id={`${ids}-cuit-help`} error={errors.cuit}>11 números. Podés escribirlo con o sin guiones.</FieldHelp>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${ids}-contactEmail`}>Email de contacto</Label>
          <Input {...fieldProps("contactEmail")} type="email" inputMode="email" placeholder="hola@homedeko.com" autoComplete="off" />
          <FieldHelp id={`${ids}-contactEmail-help`} error={errors.contactEmail}>Donde les escriben los clientes (consultas, cambios, datos personales).</FieldHelp>
        </div>
      </SectionCard>

      {/* ---------- Guardar ---------- */}
      <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-end">
        {dirty && !pending && (
          <p className="text-center text-sm text-amber-700 sm:text-right">Tenés cambios sin guardar.</p>
        )}
        <Button type="submit" size="lg" disabled={pending || !dirty}>
          {pending && <Loader2 className="animate-spin" />}
          {pending ? "Guardando…" : "Guardar cambios"}
        </Button>
      </div>
    </form>
  );
}

/** Texto de ayuda debajo de cada campo; si hay un error, muestra el error en su lugar. */
function FieldHelp({ id, error, children }: { id: string; error?: string; children: React.ReactNode }) {
  return (
    <p id={id} className={cn("text-xs", error ? "text-destructive" : "text-muted-foreground")}>
      {error ?? children}
    </p>
  );
}
