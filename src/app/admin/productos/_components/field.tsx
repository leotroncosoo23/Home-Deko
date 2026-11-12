import { cn } from "cn";
import { Label } from "@/components/ui/label";

/**
 * Un campo del formulario: etiqueta + control + ayuda o error.
 * El error reemplaza a la ayuda y se lee en rojo.
 */
export function Field({
  id,
  label,
  optional,
  help,
  error,
  className,
  children,
}: {
  id: string;
  label: React.ReactNode;
  optional?: boolean;
  help?: React.ReactNode;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)} data-error={error ? "" : undefined}>
      <Label htmlFor={id}>
        {label}
        {optional && <span className="font-normal text-muted-foreground">(opcional)</span>}
      </Label>
      {children}
      {error ? (
        <p id={`${id}-msg`} className="text-xs text-destructive">
          {error}
        </p>
      ) : help ? (
        <p id={`${id}-msg`} className="text-xs text-muted-foreground">
          {help}
        </p>
      ) : null}
    </div>
  );
}

/** Props de accesibilidad para el control de un Field. */
export function fieldProps(id: string, error?: string, hasHelp = false) {
  return {
    id,
    "aria-invalid": Boolean(error) || undefined,
    "aria-describedby": error || hasHelp ? `${id}-msg` : undefined,
  };
}
