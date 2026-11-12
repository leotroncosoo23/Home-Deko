import type { LucideIcon } from "lucide-react";
import { cn } from "cn";
import { Card } from "@/components/ui/card";

/**
 * Tarjeta de sección del panel, con encabezado de marca:
 *
 *   ┌───────────────────────────────────────────┐
 *   │ (◉)  Título                      [acción] │  ← ícono rojo en círculo rojo suave
 *   │      Una frase que explica la sección.    │
 *   ├───────────────────────────────────────────┤  ← línea fina
 *   │  contenido                                │
 *   └───────────────────────────────────────────┘
 *
 * Usarla para cada bloque de un formulario o pantalla del panel, así todas
 * se ven iguales. El rojo de marca va SOLO en el ícono (acento sutil).
 */
export function SectionCard({
  icon: Icon,
  title,
  description,
  action,
  contentClassName,
  className,
  children,
}: {
  icon: LucideIcon;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Algo a la derecha del título (un estado, un contador, un botón). */
  action?: React.ReactNode;
  contentClassName?: string;
  className?: string;
  /** Sin contenido, la tarjeta es solo el encabezado (ej.: "Agregar descuento"). */
  children?: React.ReactNode;
}) {
  return (
    <Card className={cn("gap-0 py-0", className)}>
      <div className={cn("flex items-start gap-3 px-5 py-4", children && "border-b")}>
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
          <Icon className="size-4.5" aria-hidden />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5 pt-0.5">
          {/* h2: los lectores de pantalla pueden saltar de sección en sección */}
          <h2 className="text-[0.9375rem] leading-tight font-semibold">
            {title}
          </h2>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {action && <div className="flex shrink-0 items-center gap-2 self-center">{action}</div>}
      </div>
      {children && <div className={cn("p-5", contentClassName)}>{children}</div>}
    </Card>
  );
}
