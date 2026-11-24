import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { HelpSheet } from "@/components/admin/help-sheet";
import { PageHeader } from "@/components/admin/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { getBannerForAdmin } from "../../data";
import { BackToBanners } from "../../_components/back-to-banners";
import { BannerForm } from "../../_components/banner-form";

export const metadata: Metadata = { title: "Editar banner" };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * /admin/apariencia/banner/[id] — editar un banner.
 * Todo va dentro del <Suspense>: el id de la URL y el permiso (sección
 * reservada: getBannerForAdmin arranca con requireAppearanceAccess, que sin
 * permiso responde "No encontramos esta página").
 */
export default function EditBannerPage({ params }: PageProps<"/admin/apariencia/banner/[id]">) {
  return (
    <Suspense fallback={<EditSkeleton />}>
      {params.then(({ id }) => (
        <EditBanner id={id} />
      ))}
    </Suspense>
  );
}

async function EditBanner({ id }: { id: string }) {
  // Primero el permiso: sin él, nada de la sección (ni siquiera "id inválido").
  const banner = UUID_PATTERN.test(id) ? await getBannerForAdmin(id) : null;
  if (!banner) notFound();

  return (
    <>
      <BackToBanners />
      <PageHeader eyebrow="Tienda online" title={banner.title} actions={<HelpSheet guia="apariencia" />} />
      {/* key: al guardar llegan datos nuevos y el formulario arranca con ellos */}
      <BannerForm key={banner.updatedAt} banner={banner} />
    </>
  );
}

function EditSkeleton() {
  return (
    <>
      <Skeleton className="h-8 w-64" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-96 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    </>
  );
}
