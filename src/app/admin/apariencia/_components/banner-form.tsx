"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, Eye, ImageIcon, LayoutTemplate, Loader2, MousePointerClick, Type } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { ImageField, type ImageValue } from "@/components/admin/image-field";
import { SectionCard } from "@/components/admin/section-card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { BannerView } from "@/lib/banners";
import { Field } from "../../productos/_components/field";
import { useUnsavedWarning } from "../../productos/_components/use-unsaved-warning";
import { saveBanner } from "../actions";
import { BANNER_LIMITS, normalizeButtonUrl, validateBanner } from "../schema";
import type { AdminBanner, BannerField, BannerFormValues } from "../types";
import { BannerPreview } from "./banner-preview";

type ImageSlot = "productImage" | "image" | "imageMobile";
const NO_CHANGE: ImageValue = { file: null, removed: false };

/** Imágenes grandes: más resolución que las fotos de producto (1200 px). */
const BANNER_IMAGE_MAX = 2000;

const EMPTY_BANNER: BannerFormValues = {
  kind: "template",
  title: "",
  body: "",
  buttonLabel: "Ver productos",
  buttonUrl: "/productos",
  background: "red",
  startsOn: "",
  endsOn: "",
  isActive: true,
};

/**
 * Formulario de un banner (nuevo o existente), con la vista previa en vivo.
 *
 *   PC:      campos a la izquierda, vista previa fija a la derecha.
 *   Celular: vista previa arriba, campos abajo.
 */
export function BannerForm({ banner }: { banner: AdminBanner | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const initial: BannerFormValues = banner
    ? {
        kind: banner.kind,
        title: banner.title,
        body: banner.body ?? "",
        buttonLabel: banner.buttonLabel ?? "",
        buttonUrl: banner.buttonUrl ?? "",
        background: banner.background,
        startsOn: banner.startsOn,
        endsOn: banner.endsOn,
        isActive: banner.isActive,
      }
    : EMPTY_BANNER;

  const [values, setValues] = useState<BannerFormValues>(initial);
  const [images, setImages] = useState<Record<ImageSlot, ImageValue>>({
    productImage: NO_CHANGE,
    image: NO_CHANGE,
    imageMobile: NO_CHANGE,
  });
  const [errors, setErrors] = useState<Partial<Record<BannerField, string>>>({});

  const dirty =
    JSON.stringify(values) !== JSON.stringify(initial) ||
    Object.values(images).some((i) => i.file !== null || i.removed);
  const { allowLeave } = useUnsavedWarning(dirty && !pending);

  function change(patch: Partial<BannerFormValues>) {
    setValues((v) => ({ ...v, ...patch }));
    // Al corregir un campo, su error desaparece.
    setErrors((e) => {
      const next = { ...e };
      for (const key of Object.keys(patch)) delete next[key as BannerField];
      return next;
    });
  }

  function changeImage(slot: ImageSlot, value: ImageValue) {
    setImages((i) => ({ ...i, [slot]: value }));
    setErrors((e) => ({ ...e, [slot]: undefined }));
  }

  // --- Vista previa ---------------------------------------------------
  const productPreview = useObjectUrl(images.productImage.file);
  const imagePreview = useObjectUrl(images.image.file);
  const mobilePreview = useObjectUrl(images.imageMobile.file);

  const current = (slot: ImageSlot, saved: string | null | undefined, blob: string | null) =>
    blob ?? (images[slot].removed ? null : (saved ?? null));

  const preview: BannerView = {
    kind: values.kind,
    title: values.title.trim() || (values.kind === "template" ? "Tu título acá" : "Banner"),
    body: values.body.trim() || null,
    buttonLabel: values.buttonLabel.trim() || null,
    buttonUrl: normalizeButtonUrl(values.buttonUrl) || null,
    background: values.background,
    productImageUrl: current("productImage", banner?.productImageUrl, productPreview),
    imageUrl: current("image", banner?.imageUrl, imagePreview),
    imageMobileUrl: current("imageMobile", banner?.imageMobileUrl, mobilePreview),
  };
  // Imagen completa todavía sin imagen: se muestra el de Home Deko.
  const previewBanner = preview.kind === "image" && !preview.imageUrl ? null : preview;

  // --- Guardar --------------------------------------------------------
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const checked = validateBanner(values);
    const fieldErrors: Partial<Record<BannerField, string>> = checked.ok ? {} : { ...checked.fieldErrors };
    if (values.kind === "image" && !current("image", banner?.imageUrl, imagePreview)) {
      fieldErrors.image = "Subí la imagen del banner (la versión para PC).";
    }
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      toast.error("Revisá los datos marcados.");
      return;
    }

    const formData = new FormData();
    if (banner) formData.set("id", banner.id);
    for (const [key, value] of Object.entries(values)) formData.set(key, String(value));
    for (const slot of ["productImage", "image", "imageMobile"] as const) {
      const img = images[slot];
      if (img.file) formData.set(slot, img.file);
      if (img.removed) formData.set(`remove${slot[0].toUpperCase()}${slot.slice(1)}`, "true");
    }

    startTransition(async () => {
      try {
        const result = await saveBanner(formData);
        if (result.ok) {
          toast.success(banner ? "Cambios guardados" : "Banner creado");
          allowLeave();
          router.push("/admin/apariencia");
        } else {
          setErrors(result.fieldErrors ?? {});
          toast.error(result.error);
        }
      } catch {
        toast.error("No se pudo guardar. Revisá tu conexión e intentá de nuevo.");
      }
    });
  }

  const isTemplate = values.kind === "template";
  const input = (id: BannerField) => ({
    id: `banner-${id}`,
    "aria-invalid": errors[id] ? true : undefined,
    "aria-describedby": `banner-${id}-msg`,
    disabled: pending,
  });

  return (
    <form onSubmit={handleSubmit} noValidate className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-start">
      {/* ---------- Vista previa (arriba en el celular, a la derecha en PC) ---------- */}
      <div className="lg:sticky lg:top-20 lg:order-2">
        <SectionCard icon={Eye} title="Vista previa" description="Así se va a ver en el inicio de la tienda.">
          <BannerPreview banner={previewBanner} />
        </SectionCard>
      </div>

      {/* ---------- Campos ---------- */}
      <div className="flex min-w-0 flex-col gap-6">
        <SectionCard icon={LayoutTemplate} title="Tipo de banner">
          <ChoiceGroup
            label="Tipo de banner"
            value={values.kind}
            onChange={(kind) => change({ kind })}
            disabled={pending}
            options={[
              { value: "template", title: "Plantilla", text: "Título, texto, botón y una foto, con los colores de la marca." },
              { value: "image", title: "Imagen completa", text: "Una imagen diseñada aparte (por ejemplo en Canva)." },
            ]}
          />
        </SectionCard>

        {isTemplate ? (
          <SectionCard icon={Type} title="Contenido" contentClassName="flex flex-col gap-5">
            <Field id="banner-title" label="Título" error={errors.title} help={`Corto y claro. Hasta ${BANNER_LIMITS.title} caracteres.`}>
              <Input
                {...input("title")}
                value={values.title}
                maxLength={BANNER_LIMITS.title}
                onChange={(e) => change({ title: e.target.value })}
                placeholder="Ej.: Llegó la Navidad a tu casa"
              />
            </Field>
            <Field id="banner-body" label="Texto" optional error={errors.body} help={`Una o dos frases. Hasta ${BANNER_LIMITS.body} caracteres.`}>
              <Textarea
                {...input("body")}
                value={values.body}
                maxLength={BANNER_LIMITS.body}
                rows={3}
                onChange={(e) => change({ body: e.target.value })}
                placeholder="Ej.: Vajilla, manteles y deco para tus fiestas."
              />
            </Field>
            <Field id="banner-background" label="Fondo" error={errors.background}>
              <ChoiceGroup
                label="Fondo"
                value={values.background}
                onChange={(background) => change({ background })}
                disabled={pending}
                compact
                options={[
                  { value: "red", title: "Rojo", text: "Con el logo en blanco.", swatch: "bg-brand" },
                  { value: "white", title: "Blanco", text: "Con el botón en rojo.", swatch: "bg-background border" },
                ]}
              />
            </Field>
            <Field id="banner-productImage" label="Foto de producto" optional error={errors.productImage} help="Una foto linda y luminosa. Se ve grande al lado del texto.">
              <ImageField
                currentUrl={banner?.productImageUrl ?? null}
                value={images.productImage}
                onChange={(v) => changeImage("productImage", v)}
                error={errors.productImage}
                disabled={pending}
                previewClassName="size-24"
              />
            </Field>
          </SectionCard>
        ) : (
          <SectionCard icon={ImageIcon} title="Imágenes" contentClassName="flex flex-col gap-5">
            <Field id="banner-image" label="Imagen para PC" error={errors.image}>
              <ImageField
                currentUrl={banner?.imageUrl ?? null}
                value={images.image}
                onChange={(v) => changeImage("image", v)}
                error={errors.image}
                disabled={pending}
                maxSize={BANNER_IMAGE_MAX}
                hint="Apaisada, de 1920 × 800 px. Va de borde a borde de la pantalla."
                previewClassName="h-20 w-44"
              />
            </Field>
            <Field id="banner-imageMobile" label="Imagen para celular" optional error={errors.imageMobile}>
              <ImageField
                currentUrl={banner?.imageMobileUrl ?? null}
                value={images.imageMobile}
                onChange={(v) => changeImage("imageMobile", v)}
                error={errors.imageMobile}
                disabled={pending}
                maxSize={BANNER_IMAGE_MAX}
                hint="Vertical, de 800 × 1000 px. Si no subís una, en el celular se usa la de PC."
                previewClassName="h-24 w-20"
              />
            </Field>
            <Field
              id="banner-title"
              label="Descripción de la imagen"
              error={errors.title}
              help="Qué dice o muestra la imagen. La leen quienes navegan con lector de pantalla."
            >
              <Input
                {...input("title")}
                value={values.title}
                maxLength={BANNER_LIMITS.title}
                onChange={(e) => change({ title: e.target.value })}
                placeholder="Ej.: 20 % de descuento en vajilla hasta el domingo"
              />
            </Field>
          </SectionCard>
        )}

        <SectionCard
          icon={MousePointerClick}
          title={isTemplate ? "Botón" : "Link"}
          description={isTemplate ? "Opcional. Lleva a una página de la tienda o a otro sitio." : "Opcional. Al tocar la imagen, lleva a esta página."}
          contentClassName="flex flex-col gap-5"
        >
          {isTemplate && (
            <Field id="banner-buttonLabel" label="Texto del botón" error={errors.buttonLabel}>
              <Input
                {...input("buttonLabel")}
                value={values.buttonLabel}
                maxLength={BANNER_LIMITS.buttonLabel}
                onChange={(e) => change({ buttonLabel: e.target.value })}
                placeholder="Ej.: Ver ofertas"
              />
            </Field>
          )}
          <Field
            id="banner-buttonUrl"
            label="Link"
            error={errors.buttonUrl}
            help="Una página de la tienda (ej.: /productos o /categorias/cocina) o un link completo (https://…)."
          >
            <Input
              {...input("buttonUrl")}
              value={values.buttonUrl}
              maxLength={BANNER_LIMITS.buttonUrl}
              onChange={(e) => change({ buttonUrl: e.target.value })}
              onBlur={(e) => change({ buttonUrl: normalizeButtonUrl(e.target.value) })}
              placeholder="/productos"
              autoComplete="off"
              spellCheck={false}
            />
          </Field>
        </SectionCard>

        <SectionCard
          icon={CalendarDays}
          title="Cuándo se ve"
          description="Con fechas, se prende y se apaga solo."
          contentClassName="flex flex-col gap-5"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="banner-startsOn" label="Desde" optional error={errors.startsOn} help="Vacío = desde que lo guardás.">
              <Input
                {...input("startsOn")}
                type="date"
                value={values.startsOn}
                onChange={(e) => change({ startsOn: e.target.value })}
              />
            </Field>
            <Field id="banner-endsOn" label="Hasta" optional error={errors.endsOn} help="Vacío = sin fecha de fin. Incluye ese día completo.">
              <Input
                {...input("endsOn")}
                type="date"
                value={values.endsOn}
                min={values.startsOn || undefined}
                onChange={(e) => change({ endsOn: e.target.value })}
              />
            </Field>
          </div>
          <label htmlFor="banner-isActive" className="flex items-start gap-3 rounded-lg border p-3">
            <Switch
              id="banner-isActive"
              checked={values.isActive}
              onCheckedChange={(isActive) => change({ isActive })}
              disabled={pending}
              className="mt-0.5"
            />
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">Activo</span>
              <span className="text-xs text-muted-foreground">
                Apagalo para sacarlo de la tienda sin borrarlo.
              </span>
            </span>
          </label>
        </SectionCard>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <Link href="/admin/apariencia" className={buttonVariants({ variant: "outline", size: "lg" })}>
            Cancelar
          </Link>
          <Button type="submit" size="lg" disabled={pending} className="min-w-32">
            {pending && <Loader2 className="animate-spin" />}
            {pending ? "Guardando…" : banner ? "Guardar cambios" : "Crear banner"}
          </Button>
        </div>
      </div>
    </form>
  );
}

/** URL temporal ("blob:") para ver un archivo antes de subirlo. Se libera sola. */
function useObjectUrl(file: File | null): string | null {
  const url = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url);
  }, [url]);
  return url;
}

/** Opciones grandes para elegir una (tipo de banner, fondo). */
function ChoiceGroup<T extends string>({
  label,
  value,
  onChange,
  options,
  disabled,
  compact,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: { value: T; title: string; text: string; swatch?: string }[];
  disabled?: boolean;
  compact?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="grid gap-3 sm:grid-cols-2">
      {options.map((o) => {
        const checked = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={checked}
            disabled={disabled}
            onClick={() => onChange(o.value)}
            className={cn(
              "flex items-start gap-3 rounded-lg border p-3 text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/20 disabled:opacity-60",
              checked ? "border-foreground bg-muted/50 ring-1 ring-foreground" : "hover:bg-muted/40",
              compact && "items-center",
            )}
          >
            {o.swatch ? (
              <span aria-hidden className={cn("size-7 shrink-0 rounded-full", o.swatch)} />
            ) : (
              <span
                aria-hidden
                className={cn(
                  "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border",
                  checked && "border-foreground",
                )}
              >
                {checked && <span className="size-2 rounded-full bg-foreground" />}
              </span>
            )}
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">{o.title}</span>
              <span className="text-xs text-muted-foreground">{o.text}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
