import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { ExternalLink, GalleryHorizontal, Plus } from "lucide-react";
import { HelpSheet } from "@/components/admin/help-sheet";
import { PageHeader } from "@/components/admin/page-header";
import { getNavItem } from "@/components/admin/nav-items";
import { SectionCard } from "@/components/admin/section-card";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getAnnouncementsForAdmin, getBannersForAdmin } from "./data";
import { AnnouncementsEditor } from "./_components/announcements-editor";
import { AppearanceGate } from "./_components/appearance-gate";
import { BannerList } from "./_components/banner-list";
import { BannerPreview } from "./_components/banner-preview";

const section = getNavItem("/admin/apariencia");

export const metadata: Metadata = { title: "Apariencia de la tienda" };

/**
 * /admin/apariencia — "Apariencia de la tienda":
 *   1. Barra de anuncios (hasta 4 mensajes).
 *   2. Banner principal: el que se ve HOY y la lista completa con su estado.
 *
 * Sección reservada (hoy solo el desarrollador; can_manage_appearance() en
 * la base): todo va dentro de AppearanceGate, que responde "No encontramos
 * esta página" a quien no tiene permiso.
 */
export default function AppearancePage() {
  return (
    <Suspense fallback={<AppearanceSkeleton />}>
      <AppearanceGate>
        <PageHeader
          eyebrow={section.group}
          title={section.title}
          description={section.description}
          actions={<HelpSheet guia="apariencia" />}
        />
        <Appearance />
      </AppearanceGate>
    </Suspense>
  );
}

async function Appearance() {
  const [announcements, banners] = await Promise.all([getAnnouncementsForAdmin(), getBannersForAdmin()]);
  const showing = banners.find((b) => b.isShowing) ?? null;

  return (
    <div className="flex flex-col gap-6">
      {/* key: después de guardar, el editor arranca con lo guardado */}
      <AnnouncementsEditor key={JSON.stringify(announcements)} initial={announcements} />

      <SectionCard
        icon={GalleryHorizontal}
        title="Banner principal"
        description={
          showing
            ? `Hoy se ve «${showing.title}».`
            : "Hoy se ve el banner de Home Deko, porque no hay ninguno activo en fecha."
        }
        action={
          <div className="flex flex-wrap justify-end gap-2">
            <Link href="/" target="_blank" className={buttonVariants({ variant: "outline", size: "sm" })}>
              <ExternalLink /> Ver en la tienda
            </Link>
            <Link href="/admin/apariencia/banner/nuevo" className={buttonVariants({ size: "sm" })}>
              <Plus /> Nuevo banner
            </Link>
          </div>
        }
      >
        <BannerPreview banner={showing} initialDevice="desktop" />
      </SectionCard>

      {banners.length > 0 ? (
        <BannerList banners={banners} />
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed bg-background px-6 py-12 text-center">
          <p className="font-medium">Todavía no hay banners</p>
          <p className="max-w-md text-sm text-muted-foreground">
            Creá uno para una promo o una fecha especial. Con fechas, se prende y se apaga solo.
          </p>
          <Link href="/admin/apariencia/banner/nuevo" className={buttonVariants()}>
            <Plus /> Nuevo banner
          </Link>
        </div>
      )}
    </div>
  );
}

function AppearanceSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy aria-label="Cargando">
      <Skeleton className="h-12 w-72 rounded-lg" />
      <Skeleton className="h-56 rounded-xl" />
      <Skeleton className="h-72 rounded-xl" />
    </div>
  );
}
