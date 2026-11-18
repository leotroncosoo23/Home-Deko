import Image from "next/image";
import Link from "next/link";
import type { StoreCategory } from "@/lib/store-data";
import { categoryHref } from "@/lib/store-nav";

/**
 * Grilla de categorías del inicio: foto grande con el nombre encima.
 * 2 columnas en el celular, 3 en tablet y 4 en PC.
 */
export function CategoryGrid({ categories }: { categories: StoreCategory[] }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-5 lg:grid-cols-4">
      {categories.map((c) => (
        <li key={c.id}>
          <Link
            href={categoryHref(c.slug)}
            className="group relative flex aspect-[4/5] items-end overflow-hidden rounded-2xl bg-brand-soft outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
          >
            {c.imageUrl ? (
              <>
                <Image
                  src={c.imageUrl}
                  alt=""
                  fill
                  sizes="(min-width: 1024px) 270px, (min-width: 640px) 33vw, 50vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                />
                {/* Degradé abajo para que el nombre se lea sobre cualquier foto */}
                <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
                <span className="relative p-4 font-display text-xl leading-tight font-semibold text-white md:text-2xl">
                  {c.name}
                </span>
              </>
            ) : (
              <span className="relative p-4 font-display text-xl leading-tight font-semibold text-brand md:text-2xl">
                {c.name}
              </span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}
