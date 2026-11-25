import type { Paso } from "@/content/informacion";
import { presentes } from "./info-page";
import { RichText } from "./rich-text";

/** Paso a paso numerado (Cómo comprar): círculo rojo con el número y una línea que los une. */
export function Steps({ pasos }: { pasos: Paso[] }) {
  return (
    <ol className="surface-card flex flex-col p-5 sm:p-7">
      {pasos.map((paso, i) => {
        const last = i === pasos.length - 1;
        return (
          <li key={paso.titulo} className="relative flex gap-4 pb-7 last:pb-0">
            {/* Línea vertical entre los números */}
            {!last && <span aria-hidden className="absolute top-10 bottom-1 left-[19px] w-px bg-border" />}
            <span
              aria-hidden
              className="relative flex size-10 shrink-0 items-center justify-center rounded-full bg-brand font-display text-lg font-semibold text-white tabular-nums"
            >
              {i + 1}
            </span>
            <div className="flex min-w-0 flex-col gap-2 pt-1.5">
              <h2 className="text-lg font-semibold tracking-tight">
                <span className="sr-only">Paso {i + 1}: </span>
                {paso.titulo}
              </h2>
              {presentes(paso.texto).map((t, k) => (
                <p key={k} className="text-[15px] leading-7 text-muted-foreground">
                  <RichText text={t} />
                </p>
              ))}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
