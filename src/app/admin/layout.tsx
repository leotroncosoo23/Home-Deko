import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { MobileNav } from "@/components/admin/mobile-nav";
import { MobileNavWithCounts, SidebarNavWithCounts } from "@/components/admin/nav-with-counts";
import { SidebarNav } from "@/components/admin/sidebar-nav";
import { UserMenu, UserMenuSkeleton } from "@/components/admin/user-menu";

export const metadata: Metadata = {
  title: { default: "Panel", template: "%s · Panel Home Deko" },
  robots: { index: false, follow: false }, // que Google no indexe el panel
};

/**
 * Estructura del panel: barra lateral fija (PC), barra superior y contenido.
 *
 * IMPORTANTE: este layout NO controla el acceso y SIEMPRE muestra {children}.
 *   - Quién entra lo decide src/proxy.ts (sin sesión → /login, sin rol → /sin-acceso).
 *   - Los datos se protegen con requireAdmin() y RLS.
 * Así Next puede pre-armar la estructura de cada página y la navegación entre
 * secciones es instantánea. Lo único que lee la sesión es el menú del usuario,
 * en su propio <Suspense>.
 */
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="flex flex-1 bg-surface">
      {/* ---------- Barra lateral (solo PC, desde 1024 px) ---------- */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r bg-background lg:flex">
        <div className="flex h-14 shrink-0 items-center border-b px-5">
          <Link href="/admin" aria-label="Home Deko — Inicio del panel" className="rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40">
            <Logo variant="horizontal" />
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          {/* Con contadores (ej.: Stock 4). Mientras cargan: la barra sin ellos */}
          <Suspense fallback={<SidebarNav />}>
            <SidebarNavWithCounts />
          </Suspense>
        </div>
      </aside>

      {/* ---------- Columna principal ---------- */}
      <div className="flex min-w-0 flex-1 flex-col lg:pl-60">
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur supports-backdrop-filter:bg-background/80 sm:px-6">
          <Suspense fallback={<MobileNav />}>
            <MobileNavWithCounts />
          </Suspense>
          {/* En celular el logo va en la barra superior */}
          <Link href="/admin" aria-label="Home Deko — Inicio del panel" className="lg:hidden">
            <Logo variant="horizontal" className="text-lg" />
          </Link>

          <div className="ml-auto">
            <Suspense fallback={<UserMenuSkeleton />}>
              <UserMenu />
            </Suspense>
          </div>
        </header>

        <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
