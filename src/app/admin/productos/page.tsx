import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { getNavItem } from "@/components/admin/nav-items";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getCategoryChoices, getProductList } from "./data";
import { parseListParams, type ListParams } from "./list-params";
import { ProductsBrowser } from "./_components/products-browser";

const section = getNavItem("/admin/productos");

export const metadata: Metadata = { title: "Productos" };

/**
 * /admin/productos — listado completo (paso 6).
 *
 * Los filtros vienen en la URL (?q=…&estado=…). La URL es un dato "del
 * pedido", así que se lee DENTRO del <Suspense>: el encabezado aparece al
 * instante y la lista llega enseguida.
 */
export default function ProductsPage({ searchParams }: PageProps<"/admin/productos">) {
  return (
    <>
      <PageHeader
        eyebrow={section.group}
        title={section.title}
        description={section.description}
        actions={
          <Link href="/admin/productos/nuevo" className={buttonVariants()}>
            <Plus /> Nuevo producto
          </Link>
        }
      />
      <Suspense fallback={<ProductsSkeleton />}>
        {searchParams.then((raw) => (
          <ProductsSection params={parseListParams(raw)} />
        ))}
      </Suspense>
    </>
  );
}

async function ProductsSection({ params }: { params: ListParams }) {
  const [list, categories] = await Promise.all([getProductList(params), getCategoryChoices()]);
  return <ProductsBrowser params={params} list={list} categories={categories} />;
}

function ProductsSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy aria-label="Cargando productos">
      <div className="flex flex-col gap-3 lg:flex-row">
        <Skeleton className="h-9 flex-1 rounded-lg" />
        <div className="grid grid-cols-2 gap-2 sm:flex">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-9 rounded-lg sm:w-36" />
          ))}
        </div>
      </div>
      <div className="overflow-hidden surface-card">
        <div className="h-9 border-b bg-muted/60" />
        <ul className="divide-y">
          {Array.from({ length: 6 }, (_, i) => (
            <li key={i} className="flex items-center gap-4 px-4 py-3">
              <Skeleton className="size-4 rounded" />
              <Skeleton className="size-11 rounded-md" />
              <div className="flex flex-1 flex-col gap-1.5">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="hidden h-4 w-20 md:block" />
              <Skeleton className="hidden h-4 w-16 md:block" />
              <Skeleton className="hidden h-5 w-20 rounded-full md:block" />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
