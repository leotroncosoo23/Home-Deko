/**
 * Encabezado de cada página del panel:
 *
 *   CATÁLOGO                                  ← grupo del menú, en rojo de marca
 *   Productos                    [acciones]   ← título (+ botones a la derecha)
 *   Cargá, editá y publicá…                   ← descripción
 */
export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
}: {
  title: React.ReactNode;
  description?: string;
  /** Grupo del menú (ej.: "Catálogo"). Ver `group` en nav-items.ts. */
  eyebrow?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex min-w-0 flex-col gap-1">
        {eyebrow && (
          <span className="text-xs font-semibold tracking-[0.08em] text-brand uppercase">{eyebrow}</span>
        )}
        <h1 className="truncate text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
