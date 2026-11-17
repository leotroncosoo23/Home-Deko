import type { Bloque, DocumentoLegal } from "@/content/legales";

/**
 * Dibuja un documento legal (Privacidad o Términos) a partir de los textos
 * de src/content/legales.ts:
 *
 *   LEGAL                         ← etiqueta en rojo de marca
 *   Política de privacidad        ← título
 *   Resumen…
 *   Última actualización: …
 *   [En esta página: índice]
 *   [1. Sección] [2. Sección] …   ← tarjetas blancas
 */
export function LegalDocument({ doc }: { doc: DocumentoLegal }) {
  return (
    <article className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <span className="text-xs font-semibold tracking-[0.08em] text-brand uppercase">Legal</span>
        <h1 className="font-display text-3xl leading-tight font-semibold tracking-tight sm:text-4xl">
          {doc.titulo}
        </h1>
        <p className="text-[15px] leading-7 text-muted-foreground">{doc.resumen}</p>
        <p className="text-sm text-muted-foreground">
          Última actualización:{" "}
          <time dateTime={doc.actualizado} className="font-medium text-foreground">
            {formatDate(doc.actualizado)}
          </time>
        </p>
      </header>

      {/* Índice: en el celular evita scrollear todo para llegar a una sección */}
      <nav aria-label="En esta página" className="surface-card px-5 py-4">
        <h2 className="mb-2 text-sm font-semibold">En esta página</h2>
        <ol className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
          {doc.secciones.map((s, i) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                {i + 1}. {s.titulo}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="surface-card divide-y px-5 sm:px-8">
        {doc.secciones.map((s, i) => (
          // scroll-mt: que el título no quede pegado al borde al saltar desde el índice
          <section key={s.id} id={s.id} className="scroll-mt-6 py-6">
            <h2 className="mb-3 text-lg font-semibold tracking-tight">
              <span className="text-brand">{i + 1}.</span> {s.titulo}
            </h2>
            <div className="flex flex-col gap-3 text-[15px] leading-7">
              {s.bloques.map((b, j) => (
                <BloqueView key={j} bloque={b} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </article>
  );
}

function BloqueView({ bloque }: { bloque: Bloque }) {
  if (typeof bloque === "string") return <p>{highlightMissing(bloque)}</p>;
  return (
    <ul className="flex list-disc flex-col gap-1.5 pl-5 marker:text-brand">
      {bloque.lista.map((item, k) => (
        <li key={k}>{highlightMissing(item)}</li>
      ))}
    </ul>
  );
}

/** Resalta cada "[COMPLETAR]" para que se vea que falta ese dato. */
export function highlightMissing(text: string): React.ReactNode {
  const parts = text.split(/(\[COMPLETAR\])/);
  if (parts.length === 1) return text;
  return parts.map((part, i) =>
    part === "[COMPLETAR]" ? (
      <mark key={i} className="rounded bg-amber-200 px-1 font-medium text-amber-950">
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

/** "2026-11-17" → "17 de noviembre de 2026". */
function formatDate(isoDate: string) {
  // Mediodía en Argentina: así ninguna zona horaria corre la fecha un día.
  const date = new Date(`${isoDate}T12:00:00-03:00`);
  return new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(date);
}
