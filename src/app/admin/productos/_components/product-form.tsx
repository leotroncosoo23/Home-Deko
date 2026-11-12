"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { saveProduct } from "../actions";
import { emptyValues, toInput } from "../form-state";
import { issuesToErrors, productInputSchema } from "../schema";
import type { CategoryChoice, FormErrors, FormUpdate, ProductFormValues } from "../types";
import { ImagesCard } from "./images-card";
import { GeneralCard } from "./general-card";
import { InventoryCard } from "./inventory-card";
import { OrganizationCard } from "./organization-card";
import { PricingCard } from "./pricing-card";
import { VariantsCard } from "./variants-card";

type SaveMode = "save" | "save-and-new";

/**
 * Formulario de producto: el mismo para crear y para editar.
 *
 * Guarda TODO de una vez con la Server Action saveProduct (que llama a la
 * función save_product de la base: todo o nada).
 */
export function ProductForm({
  initialValues,
  categories,
  aside,
}: {
  initialValues: ProductFormValues;
  categories: CategoryChoice[];
  /** Contenido extra para la columna derecha (ej.: tarjeta "Códigos"). */
  aside?: React.ReactNode;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState<FormErrors>({});
  // Cambiar la "key" vuelve a armar las tarjetas de cero (al cargar otro).
  const [formKey, setFormKey] = useState(0);
  const [pending, startTransition] = useTransition();
  const [pendingMode, setPendingMode] = useState<SaveMode>("save");

  const update: FormUpdate = (patchOrFn) => {
    if (typeof patchOrFn === "function") {
      // Cambio que llega "más tarde" (ej.: terminó de subir una foto):
      // se aplica sobre los valores más recientes, sin pisar nada.
      setValues((v) => ({ ...v, ...patchOrFn(v) }));
      return;
    }
    const patch = patchOrFn;
    setValues((v) => ({ ...v, ...patch }));
    // Al tocar un campo con error, el error se va.
    const touched = Object.keys(patch);
    setErrors((e) => {
      const next = Object.fromEntries(
        Object.entries(e).filter(([key]) => !touched.some((t) => key === t || key.startsWith(`${t}.`))),
      );
      return Object.keys(next).length === Object.keys(e).length ? e : next;
    });
  };

  /** Lleva la pantalla al primer campo con error. */
  function focusFirstError() {
    requestAnimationFrame(() => {
      const el = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      el?.focus({ preventScroll: true });
    });
  }

  function save(mode: SaveMode) {
    if (values.images.some((img) => img.uploading)) {
      toast.info("Esperá a que terminen de subir las fotos.");
      return;
    }

    // El id se genera recién ahora (un producto nuevo todavía no tiene).
    // Se guarda en el estado: si algo falla y se reintenta, usa el mismo.
    const id = values.id ?? crypto.randomUUID();
    if (!values.id) setValues((v) => ({ ...v, id }));

    // 1. Validar en el navegador (marca los errores sin ir al servidor)
    const parsed = productInputSchema.safeParse(toInput(values, id));
    if (!parsed.success) {
      setErrors(issuesToErrors(parsed.error.issues));
      toast.error("Revisá los campos marcados.");
      focusFirstError();
      return;
    }
    setErrors({});
    setPendingMode(mode);

    // 2. Guardar
    startTransition(async () => {
      try {
        const result = await saveProduct(parsed.data);
        if (!result.ok) {
          setErrors(result.fieldErrors ?? {});
          if (result.conflict) {
            toast.error(result.error, {
              duration: Infinity,
              action: { label: "Recargar", onClick: () => window.location.reload() },
            });
          } else {
            toast.error(result.error);
          }
          if (result.fieldErrors) focusFirstError();
          return;
        }

        const name = parsed.data.name;
        if (mode === "save-and-new") {
          toast.success(`«${name}» guardado`, {
            action: { label: "Ver", onClick: () => router.push(`/admin/productos/${result.id}`) },
          });
          if (values.isNew) {
            // Formulario limpio, conservando categoría y estado.
            setValues(emptyValues({ categoryId: values.categoryId, status: values.status }));
            setFormKey((k) => k + 1);
            window.scrollTo({ top: 0, behavior: "smooth" });
          } else {
            router.push("/admin/productos/nuevo");
          }
        } else if (values.isNew) {
          toast.success("Producto creado");
          router.push(`/admin/productos/${result.id}`);
        } else {
          // La página se vuelve a cargar sola con los datos nuevos (refresh).
          toast.success("Cambios guardados");
        }
      } catch {
        toast.error("No se pudo guardar. Revisá tu conexión e intentá de nuevo.");
      }
    });
  }

  // Errores que no son de un campo puntual (ej.: "tiene que haber una combinación")
  const generalErrors = ["_form", "variants", "options"].map((k) => errors[k]).filter(Boolean);
  const cardProps = { values, update, errors, disabled: pending };

  return (
    <form
      ref={formRef}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        save("save");
      }}
      className="flex flex-col gap-6"
    >
      {generalErrors.length > 0 && (
        <div role="alert" className="flex gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <ul>
            {generalErrors.map((msg) => (
              <li key={msg}>{msg}</li>
            ))}
          </ul>
        </div>
      )}

      <div key={formKey} className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        {/* Columna principal */}
        <div className="flex min-w-0 flex-col gap-6">
          <GeneralCard {...cardProps} />
          <ImagesCard {...cardProps} />
          <PricingCard {...cardProps} />
          <VariantsCard {...cardProps} />
          {/* Sin variantes: un solo stock y stock mínimo */}
          {!values.hasVariants && <InventoryCard {...cardProps} />}
        </div>

        {/* Columna derecha (abajo en el celular) */}
        <div className="flex flex-col gap-6 lg:sticky lg:top-20">
          <OrganizationCard {...cardProps} categories={categories} />
          {aside}
        </div>
      </div>

      {/* Barra de botones: queda pegada abajo mientras se baja por el formulario */}
      <div className="sticky bottom-0 z-10 -mx-4 flex flex-col-reverse gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur supports-backdrop-filter:bg-background/80 sm:-mx-6 sm:flex-row sm:items-center sm:justify-end sm:px-6 lg:-mx-8 lg:px-8">
        <Link href="/admin/productos" className={buttonVariants({ variant: "ghost", className: "sm:mr-auto" })}>
          Cancelar
        </Link>
        <Button type="button" variant="outline" disabled={pending} onClick={() => save("save-and-new")}>
          {pending && pendingMode === "save-and-new" && <Loader2 className="animate-spin" />}
          Guardar y cargar otro
        </Button>
        <Button type="submit" disabled={pending}>
          {pending && pendingMode === "save" && <Loader2 className="animate-spin" />}
          {pending && pendingMode === "save" ? "Guardando…" : "Guardar"}
        </Button>
      </div>
    </form>
  );
}
