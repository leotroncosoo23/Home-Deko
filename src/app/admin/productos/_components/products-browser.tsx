"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "cn";
import { deleteProduct, setProductsCategory, setProductsStatus } from "../actions";
import { DEFAULT_PARAMS, hasFilters, toQueryString, type ListParams } from "../list-params";
import type { CategoryChoice, ListActionResult, ProductListItem, ProductListPage } from "../types";
import { ArchiveDialog, ChangeCategoryDialog, DeleteProductDialog } from "./list-dialogs";
import { BulkActionsBar, NoProducts, NoResults, Pagination } from "./list-parts";
import { rememberListUrl } from "./list-url";
import { ProductsList, type RowAction } from "./products-list";
import { ProductsToolbar } from "./products-toolbar";

const LIST_PATH = "/admin/productos";

type DialogState =
  | { type: "archive"; ids: string[]; names: string[] }
  | { type: "category"; ids: string[] }
  | { type: "delete"; item: ProductListItem };

/**
 * El listado completo: filtros (en la URL), lista, selección múltiple,
 * acciones y paginación.
 *
 * Los cambios de filtro van "en transición": mientras llega la página
 * nueva se sigue viendo la anterior, un poco atenuada.
 */
export function ProductsBrowser({
  params,
  list,
  categories,
}: {
  params: ListParams;
  list: ProductListPage;
  categories: CategoryChoice[];
}) {
  const router = useRouter();
  const [navigating, startNavigation] = useTransition();
  const [acting, startAction] = useTransition();

  const query = toQueryString({ ...params, pagina: list.page });

  // Recordar la URL del listado (para "← Productos" desde la edición)
  useEffect(() => {
    rememberListUrl(`${LIST_PATH}${query}`);
  }, [query]);

  // ----- Selección: se vacía al cambiar filtros o página ------------------
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectionFor, setSelectionFor] = useState(query);
  if (selectionFor !== query) {
    setSelectionFor(query);
    setSelected(new Set());
  }
  // Solo cuentan los seleccionados que siguen en la página (ej.: después de archivar)
  const selectedItems = list.items.filter((i) => selected.has(i.id));
  const selectedIds = selectedItems.map((i) => i.id);

  // ----- Diálogos ---------------------------------------------------------
  // Se guarda el último abierto aparte de "open", para que el contenido no
  // desaparezca durante la animación de cierre.
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const openDialog = (d: DialogState) => {
    setDialog(d);
    setDialogOpen(true);
  };

  // ----- Navegar (cambiar filtros o página) -------------------------------
  function navigate(patch: Partial<ListParams>, mode: "replace" | "push" = "replace") {
    const next = { ...params, ...patch };
    startNavigation(() => {
      router[mode](`${LIST_PATH}${toQueryString(next)}`, { scroll: mode === "push" });
    });
  }
  const clearFilters = () => navigate({ ...DEFAULT_PARAMS, orden: params.orden });

  // ----- Ejecutar una acción (avisa y limpia la selección) ----------------
  async function run(action: () => Promise<ListActionResult>, { closeDialog = false } = {}): Promise<ListActionResult | null> {
    try {
      const result = await action();
      if (result.ok) {
        toast.success(result.message);
        setSelected(new Set());
        if (closeDialog) setDialogOpen(false);
      } else {
        toast.error(result.error);
        if (closeDialog && !result.canArchive) setDialogOpen(false);
      }
      return result;
    } catch {
      toast.error("No se pudo completar la acción. Revisá tu conexión e intentá de nuevo.");
      return null;
    }
  }
  const runNow = (action: () => Promise<ListActionResult>) =>
    startAction(async () => {
      await run(action);
    });

  function handleRowAction({ type, item }: RowAction) {
    if (type === "archive") openDialog({ type: "archive", ids: [item.id], names: [item.name] });
    else if (type === "unarchive") runNow(() => setProductsStatus([item.id], "draft"));
    else openDialog({ type: "delete", item });
  }

  // ----- Pantalla ----------------------------------------------------------
  const isEmptyCatalog = list.total === 0 && !hasFilters(params);

  return (
    <div className="flex flex-col gap-4">
      <ProductsToolbar params={params} categories={categories} navigate={navigate} />

      {selectedIds.length > 0 && (
        <BulkActionsBar
          count={selectedIds.length}
          anyArchived={selectedItems.some((i) => i.status === "archived")}
          anyNotArchived={selectedItems.some((i) => i.status !== "archived")}
          disabled={acting}
          onPublish={() => runNow(() => setProductsStatus(selectedIds, "active"))}
          onDraft={() => runNow(() => setProductsStatus(selectedIds, "draft"))}
          onCategory={() => openDialog({ type: "category", ids: selectedIds })}
          onArchive={() =>
            openDialog({
              type: "archive",
              ids: selectedItems.filter((i) => i.status !== "archived").map((i) => i.id),
              names: selectedItems.filter((i) => i.status !== "archived").map((i) => i.name),
            })
          }
          onUnarchive={() =>
            runNow(() => setProductsStatus(selectedItems.filter((i) => i.status === "archived").map((i) => i.id), "draft"))
          }
          onClear={() => setSelected(new Set())}
        />
      )}

      {/* Mientras carga otra página o filtro: la lista se atenúa */}
      <div
        className={cn("flex flex-col gap-4 transition-opacity", navigating && "pointer-events-none opacity-60")}
        aria-busy={navigating}
      >
        {isEmptyCatalog ? (
          <NoProducts />
        ) : list.items.length === 0 ? (
          <NoResults onClear={clearFilters} />
        ) : (
          <>
            <ProductsList
              items={list.items}
              selected={selected}
              onToggle={(id, checked) =>
                setSelected((prev) => {
                  const next = new Set(prev);
                  if (checked) next.add(id);
                  else next.delete(id);
                  return next;
                })
              }
              onToggleAll={(checked) => setSelected(checked ? new Set(list.items.map((i) => i.id)) : new Set())}
              onAction={handleRowAction}
            />
            <Pagination
              page={list.page}
              pageCount={list.pageCount}
              total={list.total}
              onPage={(pagina) => navigate({ pagina }, "push")}
            />
          </>
        )}
      </div>

      {/* ----- Diálogos ----- */}
      <ArchiveDialog
        open={dialogOpen && dialog?.type === "archive"}
        onOpenChange={setDialogOpen}
        names={dialog?.type === "archive" ? dialog.names : []}
        onConfirm={async () => {
          await run(() => setProductsStatus(dialog?.type === "archive" ? dialog.ids : [], "archived"), { closeDialog: true });
        }}
      />
      <ChangeCategoryDialog
        open={dialogOpen && dialog?.type === "category"}
        onOpenChange={setDialogOpen}
        count={dialog?.type === "category" ? dialog.ids.length : 0}
        categories={categories}
        onConfirm={async (categoryId) => {
          await run(() => setProductsCategory(dialog?.type === "category" ? dialog.ids : [], categoryId), {
            closeDialog: true,
          });
        }}
      />
      <DeleteProductDialog
        open={dialogOpen && dialog?.type === "delete"}
        onOpenChange={setDialogOpen}
        item={dialog?.type === "delete" ? dialog.item : null}
        onDelete={async () => {
          if (dialog?.type !== "delete") return;
          const item = dialog.item;
          const result = await run(() => deleteProduct(item.id), { closeDialog: true });
          // Si justo tuvo un movimiento de stock, la base no lo deja borrar:
          // el diálogo pasa a explicar por qué y a ofrecer archivarlo.
          if (result && !result.ok && result.canArchive) {
            setDialog({ type: "delete", item: { ...item, hasHistory: true } });
          }
        }}
        onArchive={async () => {
          await run(() => setProductsStatus(dialog?.type === "delete" ? [dialog.item.id] : [], "archived"), {
            closeDialog: true,
          });
        }}
      />
    </div>
  );
}
