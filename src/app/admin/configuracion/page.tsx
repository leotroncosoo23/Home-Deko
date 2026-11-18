import type { Metadata } from "next";
import { Suspense } from "react";
import { HelpSheet } from "@/components/admin/help-sheet";
import { PageHeader } from "@/components/admin/page-header";
import { getNavItem } from "@/components/admin/nav-items";
import { Skeleton } from "@/components/ui/skeleton";
import { getSettingsForAdmin } from "./data";
import { missingForLaunch } from "./schema";
import { LaunchCard } from "./_components/launch-card";
import { SettingsForm } from "./_components/settings-form";

const section = getNavItem("/admin/configuracion");

export const metadata: Metadata = { title: "Configuración" };

/**
 * /admin/configuracion
 *
 * El encabezado es estático; la configuración se lee de la base (con
 * requireAdmin, dentro de getSettingsForAdmin), así que va en <Suspense>.
 */
export default function SettingsPage() {
  return (
    <>
      <PageHeader
        title={section.title}
        description={section.description}
        actions={<HelpSheet guia="configuracion" />}
      />
      <Suspense fallback={<SettingsSkeleton />}>
        <Settings />
      </Suspense>
    </>
  );
}

async function Settings() {
  const settings = await getSettingsForAdmin();
  // key: después de guardar, el formulario arranca de nuevo con lo guardado
  // (sin el interruptor, que se guarda por su cuenta).
  const { isLaunched, ...formSettings } = settings;
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <LaunchCard isLaunched={isLaunched} missing={missingForLaunch(settings)} />
      <SettingsForm key={JSON.stringify(formSettings)} settings={settings} />
    </div>
  );
}

function SettingsSkeleton() {
  return (
    <div className="flex max-w-3xl flex-col gap-6" aria-busy aria-label="Cargando la configuración">
      {[2, 3, 3, 3].map((rows, i) => (
        <div key={i} className="flex flex-col gap-4 surface-card p-5">
          <div className="flex items-center gap-3">
            <Skeleton className="size-9 rounded-full" />
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-64" />
            </div>
          </div>
          {Array.from({ length: rows }, (_, j) => (
            <Skeleton key={j} className="h-8 w-full" />
          ))}
        </div>
      ))}
    </div>
  );
}
