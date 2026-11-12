"use client";

import Link from "next/link";
import { Archive, ArchiveRestore, ChevronLeft, ChevronRight, Eye, FileText, FolderTree, Package, Plus, Printer, SearchX, X } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { PAGE_SIZE } from "../list-params";

// ---------------------------------------------------------------------
// Barra de acciones masivas (aparece al seleccionar productos)
// ---------------------------------------------------------------------
export function BulkActionsBar({
  count,
  anyArchived,
  anyNotArchived,
  disabled,
  onPublish,
  onDraft,
  onCategory,
  onArchive,
  onUnarchive,
  onClear,
}: {
  count: number;
  anyArchived: boolean;
  anyNotArchived: boolean;
  disabled: boolean;
  onPublish: () => void;
  onDraft: () => void;
  onCategory: () => void;
  onArchive: () => void;
  onUnarchive: () => void;
  onClear: () => void;
}) {
  return (
    <div
      role="region"
      aria-label="Acciones para los productos seleccionados"
      className="sticky top-16 z-10 flex flex-wrap items-center gap-2 rounded-xl border border-foreground/15 bg-foreground px-3 py-2 text-background shadow-(--shadow-card)"
    >
      <span className="mr-1 text-sm font-medium tabular-nums">
        {count === 1 ? "1 seleccionado" : `${count} seleccionados`}
      </span>
      {anyNotArchived && (
        <>
          <BarButton onClick={onPublish} disabled={disabled}>
            <Eye /> Publicar
          </BarButton>
          <BarButton onClick={onDraft} disabled={disabled}>
            <FileText /> Pasar a borrador
          </BarButton>
        </>
      )}
      <BarButton onClick={onCategory} disabled={disabled}>
        <FolderTree /> Cambiar categoría
      </BarButton>
      {anyNotArchived && (
        <BarButton onClick={onArchive} disabled={disabled}>
          <Archive /> Archivar
        </BarButton>
      )}
      {anyArchived && (
        <BarButton onClick={onUnarchive} disabled={disabled}>
          <ArchiveRestore /> Desarchivar
        </BarButton>
      )}
      {/* Se conecta a la cola de impresión en el paso 9 (Etiquetas) */}
      <BarButton disabled title="Disponible cuando esté la sección Etiquetas">
        <Printer /> Imprimir etiquetas
      </BarButton>
      <button
        type="button"
        onClick={onClear}
        className="ml-auto flex size-8 items-center justify-center rounded-md text-background/70 outline-none hover:bg-background/10 hover:text-background focus-visible:ring-2 focus-visible:ring-background/50"
        aria-label="Quitar la selección"
        title="Quitar la selección"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

function BarButton({
  onClick,
  disabled,
  title,
  children,
}: {
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="flex h-8 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium text-background/90 outline-none hover:bg-background/10 hover:text-background focus-visible:ring-2 focus-visible:ring-background/50 disabled:cursor-not-allowed disabled:opacity-45 [&_svg]:size-4"
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------
// Paginación: "Mostrando 26–50 de 132" + Anterior / Siguiente
// ---------------------------------------------------------------------
export function Pagination({
  page,
  pageCount,
  total,
  onPage,
}: {
  page: number;
  pageCount: number;
  total: number;
  onPage: (page: number) => void;
}) {
  const from = (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);
  return (
    <nav aria-label="Páginas" className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
      <span className="tabular-nums">
        Mostrando {from}–{to} de {total} {total === 1 ? "producto" : "productos"}
      </span>
      {pageCount > 1 && (
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => onPage(page - 1)} disabled={page <= 1} className="bg-background">
            <ChevronLeft /> Anterior
          </Button>
          <span className="tabular-nums">
            Página {page} de {pageCount}
          </span>
          <Button variant="outline" size="sm" onClick={() => onPage(page + 1)} disabled={page >= pageCount} className="bg-background">
            Siguiente <ChevronRight />
          </Button>
        </div>
      )}
    </nav>
  );
}

// ---------------------------------------------------------------------
// Estados vacíos
// ---------------------------------------------------------------------
export function NoProducts() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed bg-background px-6 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-brand-soft">
        <Package className="size-5 text-brand" aria-hidden />
      </div>
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold">Cargá tu primer producto</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          Nombre, precio, stock y fotos. Si viene en varios colores o medidas, lo cargás una sola vez con sus variantes.
        </p>
      </div>
      <Link href="/admin/productos/nuevo" className={buttonVariants({ size: "lg" })}>
        <Plus /> Nuevo producto
      </Link>
    </div>
  );
}

export function NoResults({ onClear }: { onClear: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed bg-background px-6 py-14 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted">
        <SearchX className="size-5 text-muted-foreground" aria-hidden />
      </div>
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold">No hay productos con estos filtros</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          Probá con otras palabras o sacá algún filtro. Los archivados solo aparecen con el filtro «Archivados».
        </p>
      </div>
      <Button variant="outline" onClick={onClear}>
        <X /> Limpiar filtros
      </Button>
    </div>
  );
}
