import type { NextConfig } from "next";

// Imágenes públicas de NUESTRO proyecto de Supabase (bucket product-images).
// next/image solo optimiza imágenes de los orígenes que se listan acá.
const supabaseImages = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? [new URL(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/product-images/**`)]
  : [];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  reactCompiler: true,
  images: {
    remotePatterns: supabaseImages,
  },
  experimental: {
    serverActions: {
      // Las imágenes llegan a las Server Actions ya comprimidas (~100–300 KB),
      // pero dejamos margen sobre el límite por defecto de 1 MB.
      bodySizeLimit: "3mb",
    },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
