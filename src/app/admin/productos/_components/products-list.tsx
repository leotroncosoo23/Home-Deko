"use client";

import Image from "next/image";
import Link from "next/link";
import { Archive, ArchiveRestore, Copy, ImageIcon, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ProductListItem } from "../types";
import { PriceCell, StockCell, variantsText } from "./list-cells";
import { StatusBadge } from "./status-badge";

export type RowAction = { type: "archive" | "unarchive" | "delete"; item: ProductListItem };

/**
 * La lista de productos: en PC una tabla, en el celular una tarjeta por
 * producto. Cada uno con su casilla (selección múltiple) y su menú ⋯.
 */
export function ProductsList({
  items,
  selected,
  onToggle,
  onToggleAll,
  onAction,
}: {
  items: ProductListItem[];
  selected: Set<string>;
  onToggle: (id: string, checked: boolean) => void;
  onToggleAll: (checked: boolean) => void;
  onAction: (action: RowAction) => void;
}) {
  const selectedHere = items.filter((i) => selected.has(i.id)).length;
  const allChecked = selectedHere > 0 && selectedHere === items.length;

  return (
    <div className="overflow-hidden surface-card">
      {/* Encabezados (PC) */}
      <div className={cn(GRID, "hidden border-b bg-muted/60 px-4 py-2.5 text-xs font-medium text-muted-foreground md:grid")}>
        <Checkbox
          checked={allChecked}
          indeterminate={selectedHere > 0 && !allChecked}
          onCheckedChange={(checked) => onToggleAll(checked)}
          aria-label="Seleccionar todos los de esta página"
        />
        <span />
        <span>Producto</span>
        <span>Precio</span>
        <span>Stock</span>
        <span>Variantes</span>
        <span>Estado</span>
        <span />
      </div>

      {/* Celular: "seleccionar todos" arriba de las tarjetas */}
      <label className="flex items-center gap-3 border-b bg-muted/60 px-4 py-2.5 text-xs font-medium text-muted-foreground md:hidden">
        <Checkbox
          checked={allChecked}
          indeterminate={selectedHere > 0 && !allChecked}
          onCheckedChange={(checked) => onToggleAll(checked)}
        />
        Seleccionar todos
      </label>

      <ul className="divide-y">
        {items.map((item) => {
          const isSelected = selected.has(item.id);
          const href = `/admin/productos/${item.id}`;
          const check = (
            <Checkbox
              checked={isSelected}
              onCheckedChange={(checked) => onToggle(item.id, checked)}
              aria-label={`Seleccionar «${item.name}»`}
            />
          );
          const menu = <RowMenu item={item} href={href} onAction={onAction} />;

          return (
            <li key={item.id} className={cn("transition-colors", isSelected ? "bg-brand-soft/40" : "hover:bg-muted/40")}>
              {/* ---------- PC: fila ---------- */}
              <div className={cn(GRID, "hidden items-center px-4 py-2.5 md:grid")}>
                {check}
                <Thumb url={item.imageUrl} />
                <div className="flex min-w-0 flex-col">
                  <Link href={href} className="truncate font-medium outline-none hover:underline focus-visible:underline">
                    {item.name}
                  </Link>
                  <span className="truncate text-xs text-muted-foreground">{item.categoryName ?? "Sin categoría"}</span>
                </div>
                <PriceCell item={item} className="text-sm" />
                <StockCell item={item} className="text-sm" />
                <span className="text-sm text-muted-foreground">{variantsText(item)}</span>
                <span>
                  <StatusBadge status={item.status} />
                </span>
                {menu}
              </div>

              {/* ---------- Celular: tarjeta ---------- */}
              <div className="flex gap-3 px-4 py-3 md:hidden">
                <div className="pt-1">{check}</div>
                <Thumb url={item.imageUrl} large />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 flex-col">
                      <Link href={href} className="line-clamp-2 font-medium outline-none hover:underline focus-visible:underline">
                        {item.name}
                      </Link>
                      <span className="truncate text-xs text-muted-foreground">
                        {item.categoryName ?? "Sin categoría"} · {variantsText(item)}
                      </span>
                    </div>
                    <div className="-mt-1 -mr-2">{menu}</div>
                  </div>
                  <PriceCell item={item} className="text-sm" />
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <StatusBadge status={item.status} />
                    <span className="text-muted-foreground">Stock</span>
                    <StockCell item={item} />
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Columnas de la tabla en PC (escritas completas: Tailwind las busca como texto). */
const GRID = "grid-cols-[1.25rem_2.75rem_minmax(0,1fr)_8rem_8.5rem_6.5rem_6.5rem_2rem] gap-4";

function Thumb({ url, large }: { url: string | null; large?: boolean }) {
  return (
    <div
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted",
        large ? "size-16" : "size-11",
      )}
    >
      {url ? (
        <Image src={url} alt="" fill sizes={large ? "64px" : "44px"} className="object-cover" />
      ) : (
        <ImageIcon className="size-4 text-muted-foreground/60" aria-hidden />
      )}
    </div>
  );
}

function RowMenu({ item, href, onAction }: { item: ProductListItem; href: string; onAction: (a: RowAction) => void }) {
  const archived = item.status === "archived";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon" aria-label={`Acciones de «${item.name}»`} />}
      >
        <MoreHorizontal />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem render={<Link href={href} />}>
          <Pencil /> Editar
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href={`/admin/productos/nuevo?duplicar=${item.id}`} />}>
          <Copy /> Duplicar
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {archived ? (
          <DropdownMenuItem onClick={() => onAction({ type: "unarchive", item })}>
            <ArchiveRestore /> Desarchivar
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onClick={() => onAction({ type: "archive", item })}>
            <Archive /> Archivar
          </DropdownMenuItem>
        )}
        <DropdownMenuItem variant="destructive" onClick={() => onAction({ type: "delete", item })}>
          <Trash2 /> Eliminar definitivamente
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
