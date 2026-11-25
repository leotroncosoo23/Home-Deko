import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import type { Pregunta } from "@/content/informacion";
import { presentes } from "./info-page";
import { RichText } from "./rich-text";

/**
 * Preguntas frecuentes en acordeón (mismo componente que la Ayuda del panel).
 * `hiddenUntilFound`: las respuestas cerradas igual están en la página, así
 * las encuentra el buscador del navegador (Ctrl+F, que la abre sola) y Google.
 */
export function Faq({ preguntas }: { preguntas: Pregunta[] }) {
  const visibles = preguntas
    .map((p) => ({ ...p, respuesta: presentes(p.respuesta) }))
    .filter((p) => p.respuesta.length > 0);

  return (
    <div className="surface-card px-5 py-2 sm:px-7">
      <Accordion>
        {visibles.map((p, i) => (
          <AccordionItem key={p.pregunta} value={i}>
            <AccordionTrigger className="gap-4 py-4 text-[0.9375rem] font-semibold hover:no-underline">
              {p.pregunta}
            </AccordionTrigger>
            <AccordionContent hiddenUntilFound className="pb-5 text-[15px] leading-7 text-muted-foreground">
              {p.respuesta.map((r, k) => (
                <p key={k}>
                  <RichText text={r} />
                </p>
              ))}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
