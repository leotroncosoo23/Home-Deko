import type { Metadata } from "next";
import { Suspense } from "react";
import { Copy } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { getCategoryChoices, getProductCopy } from "../data";
import { emptyValues } from "../form-state";
import { BackToProducts, ProductFormSkeleton } from "../_components/form-skeleton";
import { ProductForm } from "../_components/product-form";

export const metadata: Metadata = { title: "Nuevo producto" };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * /admin/productos/nuevo                → formulario vacío
 * /admin/productos/nuevo?duplicar=<id>  → copia de otro producto
 *
 * El encabezado es estático; el formulario necesita datos (categorías y,
 * si se duplica, el producto original), por eso va en <Suspense>.
 */
export default function NewProductPage({ searchParams }: PageProps<"/admin/productos/nuevo">) {
  return (
    <>
      <div className="flex flex-col gap-2">
        <BackToProducts />
        <PageHeader title="Nuevo producto" />
      </div>
      <Suspense fallback={<ProductFormSkeleton />}>
        {searchParams.then(({ duplicar }) => (
          <NewProductForm duplicateId={typeof duplicar === "string" && UUID_PATTERN.test(duplicar) ? duplicar : null} />
        ))}
      </Suspense>
    </>
  );
}

async function NewProductForm({ duplicateId }: { duplicateId: string | null }) {
  const [categories, copy] = await Promise.all([
    getCategoryChoices(),
    duplicateId ? getProductCopy(duplicateId) : Promise.resolve(null),
  ]);

  return (
    <>
      {copy && (
        <p className="-mt-2 flex items-center gap-2 rounded-lg border bg-background px-3 py-2.5 text-sm text-muted-foreground">
          <Copy className="size-4 shrink-0" aria-hidden />
          <span>
            Copia de <span className="font-medium text-foreground">«{copy.sourceName}»</span>. Revisá el nombre, cargá
            el stock y las fotos. El SKU y los códigos de barras van a ser nuevos.
          </span>
        </p>
      )}
      <ProductForm initialValues={copy?.values ?? emptyValues()} categories={categories} />
    </>
  );
}
