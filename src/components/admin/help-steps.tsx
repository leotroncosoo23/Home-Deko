import { cn } from "cn";

/**
 * Lista de pasos numerados (1, 2, 3…) con el número en un circulito.
 * Se usa en el panel "¿Cómo funciona?" y en la página de Ayuda.
 *
 * Cada paso puede ser un texto solo, o un título + explicación.
 */
export function HelpSteps({
  steps,
  className,
}: {
  steps: (string | { titulo: string; texto: string })[];
  className?: string;
}) {
  return (
    <ol className={cn("flex flex-col gap-4", className)}>
      {steps.map((step, i) => (
        <li key={i} className="flex gap-3">
          <span
            aria-hidden
            className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand tabular-nums"
          >
            {i + 1}
          </span>
          {typeof step === "string" ? (
            <p className="pt-0.5 text-sm leading-relaxed">{step}</p>
          ) : (
            <div className="flex flex-col gap-1 pt-0.5">
              <p className="text-sm font-semibold">{step.titulo}</p>
              {/* whitespace-pre-line: un "\n" en el texto de ayuda.ts es un renglón nuevo */}
              <p className="text-sm leading-relaxed whitespace-pre-line text-muted-foreground">{step.texto}</p>
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}
