import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

// Tipografías temporales (ver CLAUDE.md):
//   Inter            → reemplaza a Gabriel Sans (textos)
//   Playfair Display → reemplaza a Frunchy Sage (logo y títulos de marca)
// Cuando estén los archivos con licencia web, se cargan con next/font/local
// usando las MISMAS variables CSS (--font-inter / --font-playfair) y no hay
// que tocar nada más.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
});

const DESCRIPTION = "Tu casa, tu refugio, con diseño y calidez.";
const SHARE_IMAGE = {
  url: "/brand/logo-cuadrado-rojo.png",
  width: 1563,
  height: 1563,
  alt: "Home Deko — Artículos del hogar",
};

export const metadata: Metadata = {
  // Base para las URLs absolutas (la imagen para compartir la necesita).
  // Sin la variable, Next usa sola la URL de producción de Vercel (o localhost).
  metadataBase: process.env.NEXT_PUBLIC_SITE_URL
    ? new URL(process.env.NEXT_PUBLIC_SITE_URL)
    : undefined,
  title: {
    default: "Home Deko — Artículos del hogar",
    template: "%s · Home Deko",
  },
  description: DESCRIPTION,
  // Pestaña del navegador y Android; iPhone usa el que genera src/app/apple-icon.tsx
  // (hay que listarlo acá: al definir `icons` a mano Next no lo agrega solo).
  icons: {
    icon: [{ url: "/brand/corazon.png", type: "image/png", sizes: "192x192" }],
    apple: [{ url: "/apple-icon", type: "image/png", sizes: "180x180" }],
  },
  // Vista previa al compartir el link (WhatsApp, Facebook, Instagram, X…)
  openGraph: {
    type: "website",
    locale: "es_AR",
    siteName: "Home Deko",
    description: DESCRIPTION,
    images: [SHARE_IMAGE],
  },
  twitter: {
    card: "summary",
    images: [SHARE_IMAGE],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es-AR"
      className={`${inter.variable} ${playfair.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        {/* Avisos (toast): toast.success("…") desde cualquier componente */}
        <Toaster position="bottom-right" richColors closeButton />
      </body>
    </html>
  );
}
