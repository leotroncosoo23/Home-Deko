import {
  Clock,
  CreditCard,
  LifeBuoy,
  Mail,
  Package,
  RefreshCw,
  ShieldCheck,
  Store,
  Tag,
  Truck,
  Undo2,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { Breadcrumbs } from "@/components/store/catalog/breadcrumbs";
import type { BloqueInfo, IconoInfo, SeccionInfo, Texto } from "@/content/informacion";
import { STORE_CONTAINER } from "@/lib/store-layout";
import { cn } from "@/lib/utils";
import { RichText } from "./rich-text";

/**
 * Armazón de las páginas de información (Cómo comprar, Envíos, Contacto…):
 *
 *   Inicio › Envíos y retiro        ← migas
 *   AYUDA                           ← etiqueta en rojo de marca
 *   Envíos y retiro                 ← título (serif display)
 *   Intro…
 *   [contenido]
 */
export function InfoPage({
  titulo,
  intro,
  href,
  eyebrow = "Ayuda",
  children,
}: {
  titulo: string;
  intro: string;
  /** Ruta de la página (para las migas). */
  href: string;
  eyebrow?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn(STORE_CONTAINER, "py-6 sm:py-10")}>
      <article className="mx-auto flex max-w-3xl flex-col gap-8">
        <header className="flex flex-col gap-3">
          <Breadcrumbs items={[{ label: titulo, href }]} />
          <span className="mt-2 text-xs font-semibold tracking-[0.08em] text-brand uppercase">{eyebrow}</span>
          <h1 className="font-display text-3xl leading-tight font-semibold tracking-tight sm:text-4xl">{titulo}</h1>
          <p className="text-[15px] leading-7 text-muted-foreground sm:text-base">{intro}</p>
        </header>
        {children}
      </article>
    </div>
  );
}

const ICONOS: Record<IconoInfo, LucideIcon> = {
  truck: Truck,
  store: Store,
  package: Package,
  clock: Clock,
  refresh: RefreshCw,
  shield: ShieldCheck,
  undo: Undo2,
  card: CreditCard,
  user: UserRound,
  tag: Tag,
  mail: Mail,
  help: LifeBuoy,
};

/** Ícono rojo en círculo rojo suave (mismo estilo que las tarjetas del inicio). */
export function InfoIcon({ icono, className }: { icono: IconoInfo; className?: string }) {
  const Icon = ICONOS[icono];
  return (
    <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand", className)}>
      <Icon aria-hidden className="size-5" />
    </span>
  );
}

/** Saca lo que no está cargado (null / false / ""). */
export function presentes(textos: Texto[]): string[] {
  return textos.filter((t): t is string => typeof t === "string" && t.trim() !== "");
}

/** Una sección queda solo si le queda algún texto después de omitir lo vacío. */
function bloquesPresentes(bloques: BloqueInfo[]) {
  return bloques
    .map((b) => (b && typeof b === "object" ? { lista: presentes(b.lista) } : b))
    .filter((b) => (b && typeof b === "object" ? b.lista.length > 0 : typeof b === "string" && b.trim() !== "")) as (
    | string
    | { lista: string[] }
  )[];
}

/** Secciones en tarjetas blancas, cada una con su ícono y su ancla (#id). */
export function InfoSections({ secciones }: { secciones: SeccionInfo[] }) {
  const visibles = secciones
    .map((s) => ({ ...s, bloques: bloquesPresentes(s.bloques) }))
    .filter((s) => s.bloques.length > 0);

  return (
    <div className="flex flex-col gap-4">
      {visibles.map((s) => (
        <section key={s.id} id={s.id} aria-labelledby={`${s.id}-titulo`} className="surface-card scroll-mt-28 p-5 sm:p-7">
          <div className="flex items-start gap-4">
            {s.icono && <InfoIcon icono={s.icono} className="hidden sm:flex" />}
            <div className="flex min-w-0 flex-1 flex-col gap-3">
              <h2 id={`${s.id}-titulo`} className="flex items-center gap-3 text-lg font-semibold tracking-tight">
                {s.icono && <InfoIcon icono={s.icono} className="size-9 sm:hidden" />}
                {s.titulo}
              </h2>
              <div className="flex flex-col gap-3 text-[15px] leading-7">
                {s.bloques.map((b, i) =>
                  typeof b === "string" ? (
                    <p key={i}>
                      <RichText text={b} />
                    </p>
                  ) : (
                    <ul key={i} className="flex list-disc flex-col gap-1.5 pl-5 marker:text-brand">
                      {b.lista.map((item, k) => (
                        <li key={k}>
                          <RichText text={item} />
                        </li>
                      ))}
                    </ul>
                  ),
                )}
              </div>
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}
