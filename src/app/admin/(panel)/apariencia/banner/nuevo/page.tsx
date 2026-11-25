import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { HelpSheet } from "@/components/admin/help-sheet";
import { PageHeader } from "@/components/admin/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BANNERS_MAX } from "@/lib/banners";
import { countBannersForAdmin } from "../../data";
import { BackToBanners } from "../../_components/back-to-banners";
import { BannerForm } from "../../_components/banner-form";
import { AppearanceGate } from "../../_components/appearance-gate";

export const metadata: Metadata = { title: "Nuevo banner" };

/**
 * /admin/apariencia/banner/nuevo — banner nuevo (formulario vacío).
 * Sección reservada: todo dentro de AppearanceGate (verifica el permiso en el
 * servidor; sin permiso → "No encontramos esta página").
 */
export default function NewBannerPage() {
  return (
    <Suspense fallback={<NewSkeleton />}>
      <AppearanceGate>
        <div className="flex flex-col gap-2">
          <BackToBanners />
          <PageHeader eyebrow="Tienda online" title="Nuevo banner" actions={<HelpSheet guia="apariencia" />} />
        </div>
        <NewBanner />
      </AppearanceGate>
    </Suspense>
  );
}

/** Con 3 banners ya no entra otro (la base también lo rechaza): se avisa. */
async function NewBanner() {
  const count = await countBannersForAdmin();
  if (count < BANNERS_MAX) return <BannerForm banner={null} />;

  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed bg-background px-6 py-12 text-center">
      <p className="font-medium">Ya hay {BANNERS_MAX} banners</p>
      <p className="max-w-md text-sm text-muted-foreground">
        Es el máximo. Para agregar uno nuevo, eliminá alguno de la lista, o editá uno de los que ya están.
      </p>
      <Link href="/admin/apariencia" className={buttonVariants()}>
        Volver a los banners
      </Link>
    </div>
  );
}

function NewSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy aria-label="Cargando">
      <Skeleton className="h-12 w-64 rounded-lg" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-96 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    </div>
  );
}
