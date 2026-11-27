"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown, Loader2, Plus, Search } from "lucide-react";
import { cn } from "cn";
import { buildCategoryTree, categoryLabel } from "@/lib/categories";

export type PickerCategory = { id: string; name: string; slug?: string; parentId: string | null; isVisible: boolean };

type Option =
  | { kind: "extra"; value: string; label: string }
  | { kind: "category"; value: string; label: string; sub: boolean; hidden: boolean }
  | { kind: "create"; value: string; label: string; name: string; parentId: string };

/** Minúsculas y sin tildes, para buscar "baño" escribiendo "bano". */
const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

/**
 * Selector de categoría del panel, con buscador:
 *
 *   [ Cocina › Utensilios          ⌄ ]
 *   ┌───────────────────────────────┐
 *   │ 🔍 Buscar categoría…          │
 *   │ Cocina                        │
 *   │    Utensilios              ✓  │
 *   │    Vajilla                    │
 *   │ Baño                          │
 *   │ + Crear "Termos" en Cocina    │  ← con onCreate y algo escrito
 *   └───────────────────────────────┘
 *
 * Se puede elegir una principal o una subcategoría. Teclado: flechas,
 * Enter para elegir, Escape para cerrar.
 */
export function CategoryPicker({
  id,
  categories,
  value,
  onChange,
  extraOptions = [],
  exclude = [],
  onlyMains = false,
  onCreate,
  placeholder = "Elegí una categoría",
  disabled = false,
  invalid = false,
  className,
}: {
  id?: string;
  categories: PickerCategory[];
  /** El id elegido, o el value de una opción extra. null = nada elegido. */
  value: string | null;
  onChange: (value: string | null) => void;
  /** Opciones arriba de todo ("Todas las categorías", "Sin categoría"…). */
  extraOptions?: { value: string; label: string }[];
  /** Categorías que no se pueden elegir (ej.: la que se está borrando). */
  exclude?: string[];
  /** Solo principales. */
  onlyMains?: boolean;
  /** Permite "+ Crear 'X' en {principal}". Devuelve la categoría creada (o null si falló). */
  onCreate?: (name: string, parentId: string) => Promise<PickerCategory | null>;
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
}) {
  const ids = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [creating, setCreating] = useState(false);
  // Las que se crean desde acá se suman a la lista sin recargar la página.
  const [created, setCreated] = useState<PickerCategory[]>([]);

  const all = useMemo(() => [...categories, ...created.filter((c) => !categories.some((x) => x.id === c.id))], [categories, created]);
  const usable = all.filter((c) => !exclude.includes(c.id) && (!onlyMains || c.parentId === null));

  const options = useMemo<Option[]>(() => {
    const q = normalize(query);
    const extras: Option[] = extraOptions
      .filter((o) => !q || normalize(o.label).includes(q))
      .map((o) => ({ kind: "extra", ...o }));
    const toOption = (c: PickerCategory, sub: boolean, label: string): Option => ({
      kind: "category",
      value: c.id,
      label,
      sub,
      hidden: !c.isVisible,
    });

    let cats: Option[];
    if (!q) {
      // Sin buscar: el árbol (principal y, debajo, sus subcategorías).
      cats = buildCategoryTree(usable).flatMap((m) => [
        toOption(m, false, m.name),
        ...m.children.map((c) => toOption(c, true, c.name)),
      ]);
    } else {
      // Buscando: lista plana con la principal ("Cocina › Utensilios").
      cats = usable
        .filter((c) => normalize(categoryLabel(c, all)).includes(q))
        .map((c) => toOption(c, false, categoryLabel(c, all)));
    }

    const creates: Option[] = [];
    const name = query.trim().replace(/\s+/g, " ");
    if (onCreate && name && !all.some((c) => normalize(c.name) === normalize(name))) {
      for (const m of all.filter((c) => c.parentId === null)) {
        creates.push({ kind: "create", value: `create:${m.id}`, label: `Crear «${name}» en ${m.name}`, name, parentId: m.id });
      }
    }
    return [...extras, ...cats, ...creates];
  }, [query, extraOptions, usable, all, onCreate]);

  const selectedLabel =
    extraOptions.find((o) => o.value === value)?.label ??
    (() => {
      const c = all.find((x) => x.id === value);
      return c ? categoryLabel(c, all) + (c.isVisible ? "" : " (oculta)") : null;
    })();

  // Clic afuera: cierra.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function openPanel() {
    if (disabled) return;
    setQuery("");
    const index = options.findIndex((o) => o.value === value);
    setActive(Math.max(0, index));
    setOpen(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function close(focusTrigger = true) {
    setOpen(false);
    if (focusTrigger) triggerRef.current?.focus();
  }

  async function choose(option: Option) {
    if (option.kind === "create") {
      if (!onCreate || creating) return;
      setCreating(true);
      const category = await onCreate(option.name, option.parentId);
      setCreating(false);
      if (!category) return;
      setCreated((list) => [...list, category]);
      onChange(category.id);
      close();
      return;
    }
    onChange(option.value);
    close();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(options.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const option = options[active];
      if (option) void choose(option);
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "Tab") {
      close(false);
    }
  }

  // La opción activa siempre a la vista.
  useEffect(() => {
    if (!open) return;
    document.getElementById(`${ids}-opt-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [active, open, ids]);

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        data-invalid={invalid || undefined}
        onClick={() => (open ? close() : openPanel())}
        className={cn(
          "flex h-8 w-full items-center justify-between gap-2 rounded-lg border border-input bg-transparent pr-2 pl-2.5 text-left text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 data-invalid:border-destructive data-invalid:ring-3 data-invalid:ring-destructive/20",
        )}
      >
        <span className={cn("truncate", !selectedLabel && "text-muted-foreground")}>{selectedLabel ?? placeholder}</span>
        <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </button>

      {open && (
        <div className="absolute top-full right-0 left-0 z-50 mt-1 min-w-64 overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/5">
          <div className="flex items-center gap-2 border-b px-2.5">
            <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <input
              ref={inputRef}
              role="combobox"
              aria-expanded
              aria-controls={`${ids}-list`}
              aria-activedescendant={options[active] ? `${ids}-opt-${active}` : undefined}
              aria-label="Buscar categoría"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={onKeyDown}
              placeholder={onCreate ? "Buscar o crear una subcategoría…" : "Buscar categoría…"}
              autoComplete="off"
              className="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            {creating && <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden />}
          </div>
          <ul id={`${ids}-list`} role="listbox" aria-label="Categorías" className="max-h-72 overflow-y-auto p-1">
            {options.length === 0 && <li className="px-2.5 py-2 text-sm text-muted-foreground">No hay categorías con ese nombre.</li>}
            {options.map((o, i) => {
              const selected = o.value === value;
              return (
                <li
                  key={o.value}
                  id={`${ids}-opt-${i}`}
                  role="option"
                  aria-selected={selected}
                  onPointerMove={() => setActive(i)}
                  onClick={() => void choose(o)}
                  className={cn(
                    "flex min-h-9 cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-sm",
                    i === active && "bg-accent text-accent-foreground",
                    o.kind === "category" && o.sub && "pl-7 text-muted-foreground",
                    o.kind === "category" && !o.sub && "font-medium",
                    o.kind === "create" && "font-medium text-brand",
                    o.kind === "extra" && "text-muted-foreground",
                  )}
                >
                  {o.kind === "create" && <Plus className="size-4 shrink-0" aria-hidden />}
                  <span className="min-w-0 flex-1 truncate">
                    {o.label}
                    {o.kind === "category" && o.hidden && <span className="font-normal text-muted-foreground"> (oculta)</span>}
                  </span>
                  {selected && <Check className="size-4 shrink-0 text-brand" aria-hidden />}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
