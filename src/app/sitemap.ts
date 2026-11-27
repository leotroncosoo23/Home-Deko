import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-url";
import { getCategoryTree, getPublishedProductSlugs } from "@/lib/store-data";
import { ALL_PRODUCTS_LINK, categoryHref, HELP_LINKS, LEGAL_LINKS, productHref } from "@/lib/store-nav";

/**
 * /sitemap.xml para Google: inicio, catálogo, categorías (con las
 * subcategorías en su URL anidada /categorias/cocina/utensilios), productos
 * publicados y páginas de ayuda y legales.
 *
 * Solo lo que se ve en la tienda: categorías visibles con productos
 * (getCategoryTree) y productos de store_products. Sin la URL del sitio
 * (local sin NEXT_PUBLIC_SITE_URL) queda vacío.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  if (!base) return [];

  const [tree, productSlugs] = await Promise.all([getCategoryTree(), getPublishedProductSlugs()]);
  const url = (path: string) => `${base}${path}`;

  return [
    { url: url("/"), changeFrequency: "daily", priority: 1 },
    { url: url(ALL_PRODUCTS_LINK.href), changeFrequency: "daily", priority: 0.9 },
    ...tree.flatMap((main) => [
      { url: url(categoryHref(main.slug)), changeFrequency: "daily" as const, priority: 0.8 },
      ...main.children.map((sub) => ({
        url: url(categoryHref(main.slug, sub.slug)),
        changeFrequency: "daily" as const,
        priority: 0.7,
      })),
    ]),
    ...productSlugs.map((slug) => ({ url: url(productHref(slug)), changeFrequency: "weekly" as const, priority: 0.6 })),
    ...[...HELP_LINKS, ...LEGAL_LINKS].map((l) => ({ url: url(l.href), changeFrequency: "monthly" as const, priority: 0.3 })),
  ];
}
