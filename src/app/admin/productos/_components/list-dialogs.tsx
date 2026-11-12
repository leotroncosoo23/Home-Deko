"use client";

import { useState, useTransition } from "react";
import { Archive, Loader2, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { CategoryChoice, ProductListItem } from "../types";

/**
 * Diálogos del listado. Cada uno recibe la acción a ejecutar (que avisa con
 * un toast y cierra el diálogo) y muestra "cargando" mientras tanto.
 */

const what = (names: string[]) => (names.length === 1 ? `«${names[0]}»` : `${names.length} productos`);

// ---------------------------------------------------------------------
// Archivar
// ---------------------------------------------------------------------
export function ArchiveDialog({
  open,
  onOpenChange,
  names,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  names: string[];
  onConfirm: () => Promise<void>;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia>
            <Archive className="text-muted-foreground" />
          </AlertDialogMedia>
          <AlertDialogTitle>¿Archivar {what(names)}?</AlertDialogTitle>
          <AlertDialogDescription>
            Deja{names.length === 1 ? "" : "n"} de verse en la tienda y en el listado normal (aparece
            {names.length === 1 ? "" : "n"} en el filtro «Archivados»). No se pierde nada: se puede desarchivar
            cuando quieras, y vuelve{names.length === 1 ? "" : "n"} como Borrador.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            variant="outline"
            disabled={pending}
            onClick={() => startTransition(onConfirm)}
          >
            {pending ? <Loader2 className="animate-spin" /> : <Archive />}
            Archivar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ---------------------------------------------------------------------
// Cambiar categoría (en masa)
// ---------------------------------------------------------------------
const NONE = "ninguna";

export function ChangeCategoryDialog({
  open,
  onOpenChange,
  count,
  categories,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  count: number;
  categories: CategoryChoice[];
  onConfirm: (categoryId: string | null) => Promise<void>;
}) {
  const [value, setValue] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const items = [
    { value: NONE, label: "Sin categoría" },
    ...categories.map((c) => ({ value: c.id, label: c.isVisible ? c.name : `${c.name} (oculta)` })),
  ];

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setValue(null);
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cambiar categoría</DialogTitle>
          <DialogDescription>
            Se va a cambiar en {count === 1 ? "1 producto" : `${count} productos`}.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="bulk-category">Nueva categoría</Label>
          <Select items={items} value={value} onValueChange={(v) => setValue(v ? String(v) : null)}>
            <SelectTrigger id="bulk-category" className="w-full">
              <SelectValue placeholder="Elegí una categoría" />
            </SelectTrigger>
            <SelectContent>
              {items.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" disabled={pending} />}>Cancelar</DialogClose>
          <Button
            type="button"
            disabled={pending || value === null}
            onClick={() => startTransition(() => onConfirm(value === NONE ? null : value))}
          >
            {pending && <Loader2 className="animate-spin" />}
            Cambiar categoría
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------
// Eliminar definitivamente (o explicar por qué no y ofrecer archivar)
// ---------------------------------------------------------------------
export function DeleteProductDialog({
  open,
  onOpenChange,
  item,
  onDelete,
  onArchive,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: ProductListItem | null;
  onDelete: () => Promise<void>;
  onArchive: () => Promise<void>;
}) {
  const [pending, startTransition] = useTransition();
  if (!item) return null;
  const canArchive = item.status !== "archived";

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        {item.hasHistory ? (
          <>
            <AlertDialogHeader>
              <AlertDialogMedia>
                <Archive className="text-muted-foreground" />
              </AlertDialogMedia>
              <AlertDialogTitle>No se puede eliminar «{item.name}»</AlertDialogTitle>
              <AlertDialogDescription>
                Tiene historial de stock (ventas o ajustes), y ese historial se conserva siempre.
                {canArchive
                  ? " Podés archivarlo: deja de verse en la tienda y en el listado, y se conserva todo."
                  : " Ya está archivado, así que no se ve en la tienda."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              {canArchive ? (
                <>
                  <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
                  <AlertDialogAction disabled={pending} onClick={() => startTransition(onArchive)}>
                    {pending ? <Loader2 className="animate-spin" /> : <Archive />}
                    Archivar
                  </AlertDialogAction>
                </>
              ) : (
                <AlertDialogCancel>Entendido</AlertDialogCancel>
              )}
            </AlertDialogFooter>
          </>
        ) : (
          <>
            <AlertDialogHeader>
              <AlertDialogMedia className="bg-destructive/10">
                <Trash2 className="text-destructive" />
              </AlertDialogMedia>
              <AlertDialogTitle>¿Eliminar «{item.name}» definitivamente?</AlertDialogTitle>
              <AlertDialogDescription>
                Se borran el producto, sus variantes, sus códigos de barras y sus fotos. Esto no se puede deshacer.
                Si solo querés que no se vea, mejor archivalo.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
              {/* Acción destructiva: botón con borde rojo (CLAUDE.md) */}
              <AlertDialogAction
                variant="outline"
                disabled={pending}
                onClick={() => startTransition(onDelete)}
                className="border-destructive/40 text-destructive hover:bg-destructive/5 hover:text-destructive"
              >
                {pending ? <Loader2 className="animate-spin" /> : <Trash2 />}
                {pending ? "Eliminando…" : "Eliminar"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
