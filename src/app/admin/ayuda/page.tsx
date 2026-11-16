import type { Metadata } from "next";
import { MessageCircle, MessagesSquare } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { HelpSteps } from "@/components/admin/help-steps";
import { getNavItem } from "@/components/admin/nav-items";
import { SectionCard } from "@/components/admin/section-card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { buttonVariants } from "@/components/ui/button";
import { CONTACTO, GUIAS, PREGUNTAS_FRECUENTES, whatsappHref } from "@/content/ayuda";

const section = getNavItem("/admin/ayuda");

export const metadata: Metadata = { title: "Ayuda" };

/**
 * /admin/ayuda — ayuda para los dueños.
 *   1. Contacto por WhatsApp.
 *   2. Paso a paso de cada sección (cada bloque tiene un id, así el botón
 *      "¿Cómo funciona?" de cada pantalla puede saltar directo: /admin/ayuda#stock).
 *   3. Preguntas frecuentes en acordeón.
 *
 * No lee la base: todo el texto sale de src/content/ayuda.ts.
 */
export default function HelpPage() {
  const guias = Object.values(GUIAS);
  const whatsapp = whatsappHref();

  return (
    <>
      <PageHeader title={section.title} description={section.description} />

      {/* Atajos a cada guía (sobre todo útiles en el celular, donde la página es larga) */}
      <nav aria-label="Ir a una sección de la ayuda" className="-mt-2 flex flex-wrap gap-2">
        {guias.map((g) => (
          <a
            key={g.id}
            href={`#${g.id}`}
            className="rounded-full border bg-background px-3 py-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
          >
            {g.titulo}
          </a>
        ))}
        <a
          href="#preguntas"
          className="rounded-full border bg-background px-3 py-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
        >
          Preguntas frecuentes
        </a>
      </nav>

      {/* ---------- Contacto ---------- */}
      <SectionCard
        icon={MessageCircle}
        title="¿Tenés una duda?"
        description={
          whatsapp
            ? `Escribile a ${CONTACTO.nombre} por WhatsApp y te responde lo antes posible.`
            : `Consultale a ${CONTACTO.nombre}.`
        }
        action={
          whatsapp && (
            <a href={whatsapp} target="_blank" rel="noopener noreferrer" className={buttonVariants()}>
              <MessageCircle aria-hidden /> <span className="hidden sm:inline">Escribir por</span> WhatsApp
            </a>
          )
        }
      />

      {/* ---------- Paso a paso ---------- */}
      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold tracking-tight">Paso a paso</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          {guias.map((g) => (
            // scroll-mt: que al saltar con #id no quede tapado por la barra superior
            <section key={g.id} id={g.id} className="scroll-mt-20">
              <SectionCard
                icon={getNavItem(`/admin/${g.id}`).icon}
                title={g.titulo}
                description={g.resumen}
                className="h-full"
              >
                <HelpSteps steps={g.pasos} />
              </SectionCard>
            </section>
          ))}
        </div>
      </div>

      {/* ---------- Preguntas frecuentes ---------- */}
      <section id="preguntas" className="scroll-mt-20">
        <SectionCard
          icon={MessagesSquare}
          title="Preguntas frecuentes"
          description="Tocá una pregunta para ver la respuesta."
          contentClassName="px-5 py-1"
        >
          <Accordion>
            {PREGUNTAS_FRECUENTES.map((p, i) => (
              <AccordionItem key={i} value={i}>
                <AccordionTrigger className="py-3.5 text-[0.9375rem] hover:no-underline">
                  {p.pregunta}
                </AccordionTrigger>
                <AccordionContent className="pb-4 leading-relaxed text-muted-foreground">
                  {p.respuesta}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </SectionCard>
      </section>
    </>
  );
}
