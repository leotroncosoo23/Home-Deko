import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ChartNoAxesColumn, ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { getNavItem, NAV_ITEMS, type NavItem } from "@/components/admin/nav-items";

const section = getNavItem("/admin");

export const metadata: Metadata = { title: "Inicio" };

/**
 * /admin — Inicio del panel.
 *
 * Por ahora: accesos directos a cada sección y el lugar de las ventas, con
 * un estado vacío claro (el Inicio con ventas y visitas es el paso 8).
 * Es 100 % estático, así que la navegación hacia acá es instantánea.
 * Cuando lea datos, ponerlos dentro de <Suspense> y usar requireAdmin().
 */
export default function AdminHomePage() {
  // Sin las secciones reservadas (ej.: Banner, solo desarrollador): esta
  // página es estática y no sabe quién la mira. Están en el menú.
  const shortcuts = NAV_ITEMS.filter((item) => item.href !== "/admin" && !item.feature);

  return (
    <>
      <PageHeader eyebrow={section.group} title="¡Hola!" description="¿Qué quieren hacer hoy?" />

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {shortcuts.map((item) => (
          <li key={item.href}>
            <Shortcut item={item} />
          </li>
        ))}
        <li>
          <Link
            href="/"
            target="_blank"
            className="group flex h-full items-start gap-3 surface-card p-4 transition-shadow outline-none hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/20"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
              <ExternalLink className="size-4.5" aria-hidden />
            </span>
            <span className="flex flex-col gap-0.5">
              <span className="font-medium">Ver tienda</span>
              <span className="text-sm text-muted-foreground">Mirá cómo la ven los clientes (se abre en otra pestaña).</span>
            </span>
          </Link>
        </li>
      </ul>

      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-background px-6 py-12 text-center">
        <div className="flex size-11 items-center justify-center rounded-full bg-brand-soft">
          <ChartNoAxesColumn className="size-5 text-brand" aria-hidden />
        </div>
        <p className="font-medium">Ventas de la tienda</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Acá vas a ver las ventas cuando se lance la tienda.
        </p>
      </div>
    </>
  );
}

function Shortcut({ item }: { item: NavItem }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className="group flex h-full items-start gap-3 surface-card p-4 transition-shadow outline-none hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/20"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
        <Icon className="size-4.5" aria-hidden />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-center gap-1 font-medium">
          {item.title}
          <ArrowRight className="size-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
        </span>
        <span className="text-sm text-muted-foreground">{item.description}</span>
      </span>
    </Link>
  );
}
