import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/admin/page-header";
import { getCategoryChoices } from "../data";
import { emptyValues } from "../form-state";
import { BackToProducts, ProductFormSkeleton } from "../_components/form-skeleton";
import { ProductForm } from "../_components/product-form";

export const metadata: Metadata = { title: "Nuevo producto" };

/** /admin/productos/nuevo — el encabezado es estático; el formulario
 *  necesita las categorías (de la base), por eso va en <Suspense>. */
export default function NewProductPage() {
  return (
    <>
      <div className="flex flex-col gap-2">
        <BackToProducts />
        <PageHeader title="Nuevo producto" />
      </div>
      <Suspense fallback={<ProductFormSkeleton />}>
        <NewProductForm />
      </Suspense>
    </>
  );
}

async function NewProductForm() {
  const categories = await getCategoryChoices();
  return <ProductForm initialValues={emptyValues()} categories={categories} />;
}
