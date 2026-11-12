import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { getNavItem } from "@/components/admin/nav-items";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getProducts } from "./data";
import { ProductsTable } from "./_components/products-table";

const section = getNavItem("/admin/productos");

export const metadata: Metadata = { title: "Productos" };

/**
 * /admin/productos — lista mínima (paso 5). El listado completo con
 * buscador, filtros y paginación es el paso 6.
 */
export default function ProductsPage() {
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
      <div>
        <Suspense fallback={<ProductsSkeleton />}>
          <ProductsList />
        </Suspense>
      </div>
    </>
  );
}

async function ProductsList() {
  const products = await getProducts();
  return <ProductsTable products={products} />;
}

function ProductsSkeleton() {
  return (
    <div className="overflow-hidden surface-card" aria-busy aria-label="Cargando productos">
      <ul className="divide-y">
        {Array.from({ length: 5 }, (_, i) => (
          <li key={i} className="flex items-center gap-3 px-4 py-3">
            <Skeleton className="size-10 rounded-md" />
            <div className="flex flex-1 flex-col gap-1.5">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-4 w-20" />
          </li>
        ))}
      </ul>
    </div>
  );
}
