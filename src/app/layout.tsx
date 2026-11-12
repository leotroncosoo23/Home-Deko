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

export const metadata: Metadata = {
  title: {
    default: "Home Deko — Artículos del hogar",
    template: "%s · Home Deko",
  },
  description: "Tu casa, tu refugio, con diseño y calidez.",
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
