import Image from "next/image";
import Link from "next/link";
import { cn } from "cn";
import type { StoreCategory } from "@/lib/store-data";
import { categoryHref } from "@/lib/store-nav";

/**
 * CATEGORÍAS del inicio: tarjetas grandes con la "Foto de portada" de cada
 * categoría (se carga en el panel), el nombre encima y el botón "Ver más".
 *
 *   [celular] carrusel que se desliza (una tarjeta y el borde de la siguiente)
 *   [tablet]  grilla de 2 · [PC] grilla de 3
 *
 * Sin foto: un fondo cálido con el corazón de la marca, nunca una tarjeta vacía.
 * Toda la tarjeta es un solo link (el "Ver más" es parte del link, no otro botón).
 */
export function CategoryShowcase({ categories }: { categories: StoreCategory[] }) {
  return (
    <ul
      className={cn(
        // Celular: carrusel de borde a borde (mismo margen que STORE_CONTAINER).
        "-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain scroll-px-4 px-4 pb-1",
        "[scrollbar-width:none] sm:-mx-6 sm:scroll-px-6 sm:px-6 [&::-webkit-scrollbar]:hidden",
        "*:w-[85%] *:shrink-0 *:snap-start sm:*:w-[60%]",
        // Desde tablet: grilla, sin scroll.
        "md:mx-0 md:grid md:grid-cols-2 md:gap-6 md:overflow-visible md:px-0 md:pb-0 md:*:w-auto lg:grid-cols-3",
      )}
    >
      {categories.map((c) => (
        <li key={c.id}>
          <Link
            href={categoryHref(c.slug)}
            className="group relative flex aspect-[4/3] flex-col items-start justify-end gap-3 overflow-hidden rounded-2xl p-5 outline-none focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:ring-offset-2 md:p-6"
          >
            {c.imageUrl ? (
              <>
                <Image
                  src={c.imageUrl}
                  alt=""
                  fill
                  sizes="(min-width: 1440px) 450px, (min-width: 1024px) 31vw, (min-width: 768px) 46vw, (min-width: 640px) 60vw, 85vw"
                  className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
                />
                {/* Degradé abajo: el nombre se lee sobre cualquier foto */}
                <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/15 to-transparent" />
              </>
            ) : (
              <NoCover />
            )}

            <span
              className={cn(
                "relative font-display text-2xl leading-tight font-semibold md:text-[28px]",
                c.imageUrl ? "text-white [text-shadow:0_1px_12px_rgb(0_0_0/0.35)]" : "text-foreground",
              )}
            >
              {c.name}
            </span>
            <span
              aria-hidden
              className={cn(
                "relative inline-flex h-9 items-center rounded-full px-4 text-sm font-semibold transition-colors",
                c.imageUrl
                  ? "bg-white text-foreground group-hover:bg-white/90"
                  : "bg-foreground text-white group-hover:bg-foreground/85",
              )}
            >
              Ver más
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Fondo de una categoría sin foto: cálido, con el corazón de la marca grande y suave. */
function NoCover() {
  return (
    <span aria-hidden className="absolute inset-0 bg-gradient-to-br from-brand-soft to-[#eeeae6]">
      <Image
        src="/brand/corazon.png"
        alt=""
        width={160}
        height={160}
        className="absolute -top-4 -right-4 size-36 opacity-[0.08] md:size-40"
      />
    </span>
  );
}
