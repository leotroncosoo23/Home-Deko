import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Copy } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getCategoryChoices, getProductForEdit } from "../data";
import { CodesCard } from "../_components/codes-card";
import { BackToProducts, ProductFormSkeleton } from "../_components/form-skeleton";
import { ProductForm } from "../_components/product-form";
import { StatusBadge } from "../_components/status-badge";

export const metadata: Metadata = { title: "Editar producto" };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * /admin/productos/[id] — editar.
 *
 * El id de la URL es un dato "del pedido": no se conoce de antemano. Por
 * eso NO se espera acá arriba (bloquearía toda la página), sino adentro
 * del <Suspense>: el "← Productos" aparece al instante.
 */
export default function EditProductPage({ params }: PageProps<"/admin/productos/[id]">) {
  return (
    <>
      <BackToProducts />
      <Suspense fallback={<EditSkeleton />}>
        {params.then(({ id }) => (
          <EditProduct id={id} />
        ))}
      </Suspense>
    </>
  );
}

async function EditProduct({ id }: { id: string }) {
  if (!UUID_PATTERN.test(id)) notFound();

  const [product, categories] = await Promise.all([getProductForEdit(id), getCategoryChoices()]);
  if (!product) notFound();

  return (
    <>
      <PageHeader
        title={product.name}
        actions={
          <>
            <StatusBadge status={product.status} />
            <Link href={`/admin/productos/nuevo?duplicar=${id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
              <Copy /> Duplicar
            </Link>
          </>
        }
      />
      {/* key: cuando se guarda, la página trae datos nuevos (otra fecha de
          actualización) y el formulario se rearma con ellos. */}
      <ProductForm
        key={product.updatedAt}
        initialValues={product.values}
        categories={categories}
        aside={<CodesCard codes={product.codes} />}
      />
    </>
  );
}

function EditSkeleton() {
  return (
    <>
      <Skeleton className="h-8 w-64" />
      <ProductFormSkeleton />
    </>
  );
}
