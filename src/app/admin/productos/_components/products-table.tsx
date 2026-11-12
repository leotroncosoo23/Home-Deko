import Image from "next/image";
import Link from "next/link";
import { ImageIcon, Package, Plus } from "lucide-react";
import { cn } from "cn";
import { buttonVariants } from "@/components/ui/button";
import { formatARS } from "@/lib/format";
import type { ProductListItem } from "../types";
import { StatusBadge } from "./status-badge";

/**
 * Lista MÍNIMA de productos, para poder entrar a crear y editar.
 * El listado completo (buscador, filtros, paginación) es el paso 6.
 */
export function ProductsTable({ products }: { products: ProductListItem[] }) {
  if (products.length === 0) return <EmptyProducts />;

  return (
    <div className="overflow-hidden rounded-xl border bg-background">
      <div className="hidden grid-cols-[2.5rem_minmax(0,1fr)_6.5rem_6rem_5rem_8rem] items-center gap-4 border-b bg-muted/40 px-4 py-2 text-xs font-medium text-muted-foreground md:grid">
        <span />
        <span>Producto</span>
        <span>Estado</span>
        <span>Variantes</span>
        <span className="text-right">Stock</span>
        <span className="text-right">Precio</span>
      </div>
      <ul className="divide-y">
        {products.map((p) => (
          <li key={p.id}>
            <Link
              href={`/admin/productos/${p.id}`}
              className="grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-3 py-2.5 outline-none hover:bg-muted/40 focus-visible:bg-muted/60 md:grid-cols-[2.5rem_minmax(0,1fr)_6.5rem_6rem_5rem_8rem] md:gap-4 md:px-4"
            >
              {/* Miniatura */}
              <div className="relative row-span-2 flex size-10 items-center justify-center overflow-hidden rounded-md border bg-muted md:row-span-1">
                {p.imageUrl ? (
                  <Image src={p.imageUrl} alt="" fill sizes="40px" className="object-cover" />
                ) : (
                  <ImageIcon className="size-4 text-muted-foreground/60" aria-hidden />
                )}
              </div>

              {/* Nombre y categoría */}
              <div className="flex min-w-0 flex-col">
                <span className="truncate font-medium">{p.name}</span>
                <span className="truncate text-xs text-muted-foreground">{p.categoryName ?? "Sin categoría"}</span>
              </div>

              {/* Precio en el celular (arriba a la derecha) */}
              <span className="text-right text-sm tabular-nums md:hidden">{priceText(p)}</span>

              {/* Estado */}
              <span className="col-start-2 flex items-center gap-2 md:col-start-auto">
                <StatusBadge status={p.status} />
                <span className="text-xs text-muted-foreground md:hidden">
                  · {stockText(p)}
                </span>
              </span>

              {/* Desde tablet: variantes, stock, precio */}
              <span className="hidden text-sm text-muted-foreground md:block">
                {p.hasVariants ? `${p.variantCount} variantes` : "Única"}
              </span>
              <span className={cn("hidden text-right text-sm tabular-nums md:block", stockClass(p))}>
                {p.totalStock}
              </span>
              <span className="hidden text-right text-sm tabular-nums md:block">{priceText(p)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function priceText(p: ProductListItem) {
  return p.minPrice === p.maxPrice ? formatARS(p.minPrice) : `desde ${formatARS(p.minPrice)}`;
}

function stockText(p: ProductListItem) {
  if (p.totalStock === 0) return "Sin stock";
  return `Stock ${p.totalStock}`;
}

/** Rojo de marca = sin stock; ámbar = alguna variante en el mínimo o menos. */
function stockClass(p: ProductListItem) {
  if (p.totalStock === 0) return "font-medium text-brand";
  if (p.lowStock) return "font-medium text-amber-700";
  return "";
}

function EmptyProducts() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed bg-background px-6 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-brand-soft">
        <Package className="size-5 text-brand" aria-hidden />
      </div>
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold">Cargá tu primer producto</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          Nombre, precio, stock y fotos. Si viene en varios colores o medidas, lo cargás una sola vez con sus
          variantes.
        </p>
      </div>
      <Link href="/admin/productos/nuevo" className={buttonVariants({ size: "lg" })}>
        <Plus /> Nuevo producto
      </Link>
    </div>
  );
}
