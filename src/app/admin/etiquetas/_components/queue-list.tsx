"use client";

import Image from "next/image";
import Link from "next/link";
import { ImageIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LabelQueueItem } from "../types";
import { QuantityStepper } from "./quantity-stepper";

/**
 * La cola: una fila por variante, con su cantidad editable y el botón
 * para quitarla. En el celular la fila se acomoda en dos renglones.
 */
export function QueueList({
  items,
  quantityOf,
  onQuantity,
  onRemove,
}: {
  items: LabelQueueItem[];
  /** Cantidad que se muestra (puede ser la que se está escribiendo). */
  quantityOf: (item: LabelQueueItem) => string;
  onQuantity: (item: LabelQueueItem, value: string) => void;
  onRemove: (item: LabelQueueItem) => void;
}) {
  return (
    <ul className="divide-y">
      {items.map((item) => {
        const fullName = `${item.productName}${item.variantLabel ? ` ${item.variantLabel}` : ""}`;
        return (
          <li key={item.variantId} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:flex-nowrap">
            <div className="relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
              {item.imageUrl ? (
                <Image src={item.imageUrl} alt="" fill sizes="40px" className="object-cover" />
              ) : (
                <ImageIcon className="size-4 text-muted-foreground/60" aria-hidden />
              )}
            </div>

            <div className="flex min-w-0 flex-1 flex-col">
              <Link href={`/admin/productos/${item.productId}`} className="truncate text-sm font-medium hover:underline">
                {item.productName}
              </Link>
              <span className="truncate text-xs text-muted-foreground">
                {item.variantLabel ?? "Única"}
                <span className="font-mono tabular-nums"> · {item.barcode}</span>
              </span>
            </div>

            {/* En el celular: segunda línea, alineada a la derecha */}
            <div className="ml-auto flex items-center gap-3 sm:ml-0">
              <span className="text-xs text-muted-foreground tabular-nums">
                Stock <span className="font-semibold text-foreground">{item.stock}</span>
              </span>
              <QuantityStepper
                value={quantityOf(item)}
                onChange={(value) => onQuantity(item, value)}
                label={`Cantidad de etiquetas de ${fullName}`}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => onRemove(item)}
                aria-label={`Quitar ${fullName} de la cola`}
                title="Quitar de la cola"
                className="text-muted-foreground hover:text-foreground"
              >
                <X />
              </Button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
