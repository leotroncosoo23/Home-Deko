import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { ExternalLink } from "lucide-react";
import { HelpSheet } from "@/components/admin/help-sheet";
import { PageHeader } from "@/components/admin/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUser } from "@/lib/auth";
import { parsePeriod, todayInArgentina } from "@/lib/dashboard-period";
import { firstNameOf } from "@/lib/format";
import { AttentionCard } from "./_inicio/attention-card";
import { getAttention, getDashboard, getLatestOrders } from "./_inicio/data";
import { LatestOrders, TopProducts } from "./_inicio/lists";
import { PeriodPicker } from "./_inicio/period-picker";
import { SalesChart } from "./_inicio/sales-chart";
import { StatCards } from "./_inicio/stat-cards";
import { VisitsCard } from "./_inicio/visits-card";

export const metadata: Metadata = { title: "Inicio" };

/**
 * /admin — Inicio del panel: cómo viene la TIENDA ONLINE (las ventas del
 * local son el futuro Módulo Local).
 *
 *   1. Requiere atención (su propio <Suspense>: aparece primero)
 *   2. Período (en la URL) → tarjetas, gráfico, más vendidos, últimos pedidos y visitas
 *
 * Todo se calcula en la base (admin_home_attention / admin_dashboard): rápido
 * aunque haya miles de pedidos. El encabezado es estático y se ve al instante.
 */
export default function AdminHomePage({ searchParams }: PageProps<"/admin">) {
  return (
    <>
      <PageHeader
        // El nombre lee la sesión: en su propio <Suspense> (mientras tanto, "¡Hola!")
        title={
          <Suspense fallback="¡Hola!">
            <Greeting />
          </Suspense>
        }
        description="Así viene la tienda online."
        actions={
          <>
            <HelpSheet guia="inicio" />
            <Link href="/" target="_blank" className={buttonVariants({ variant: "outline" })}>
              <ExternalLink aria-hidden />
              Ver tienda
              <span className="sr-only"> (se abre en otra pestaña)</span>
            </Link>
          </>
        }
      />

      <Suspense fallback={<Skeleton className="h-16 w-full rounded-xl" />}>
        <AttentionSection />
      </Suspense>

      <Suspense fallback={<DashboardSkeleton />}>
        {searchParams.then((raw) => (
          <DashboardSection raw={raw} />
        ))}
      </Suspense>
    </>
  );
}

/** "¡Hola, Natasha!" con el primer nombre del perfil; sin nombre, "¡Hola!". */
async function Greeting() {
  const user = await getCurrentUser();
  const name = user?.fullName ? firstNameOf(user.fullName) : "";
  return name ? `¡Hola, ${name}!` : "¡Hola!";
}

async function AttentionSection() {
  return <AttentionCard attention={await getAttention()} />;
}

async function DashboardSection({ raw }: { raw: Record<string, string | string[] | undefined> }) {
  // connection(): esto depende del momento del pedido. Sin esto, Next intenta
  // pre-armar la sección (con los searchParams ya conocidos, en la precarga de
  // la navegación) y se queja de "new Date()". Con esto, "hoy" se calcula
  // siempre en cada pedido (nunca queda guardado de otro día).
  await connection();
  const today = todayInArgentina();
  const period = parsePeriod(raw, today);
  const [data, latest] = await Promise.all([getDashboard(period), getLatestOrders()]);

  return (
    <div className="flex flex-col gap-4">
      <PeriodPicker period={period} today={today} />
      <StatCards data={data} period={period} />
      <SalesChart data={data} period={period} />
      <div className="grid gap-4 lg:grid-cols-2">
        <TopProducts data={data} />
        <LatestOrders orders={latest} />
      </div>
      <VisitsCard data={data} period={period} />
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy aria-label="Cargando las ventas">
      <div className="flex gap-1.5">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-8 w-20 rounded-full" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-72 rounded-xl" />
    </div>
  );
}
