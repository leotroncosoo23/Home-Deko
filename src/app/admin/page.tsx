import { Suspense } from "react";
import { Logo } from "@/components/brand/logo";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";

/**
 * /admin — página de prueba del paso 2.
 * En el paso 3 se reemplaza por el layout del panel con la barra lateral.
 *
 * Patrón para todas las páginas del panel:
 *   - La parte fija (encabezado, tarjetas) se muestra al instante.
 *   - Lo que lee datos del usuario o de la base va dentro de <Suspense>,
 *     con un "esqueleto" mientras carga. Así navegar entre páginas es inmediato.
 *
 * El control de acceso lo hace src/app/admin/layout.tsx. Ojo: Next puede
 * renderizar el layout y la página EN PARALELO, así que acá no se redirige
 * (si redirigiera a /admin, un no-admin entraría en un bucle).
 */
export default function AdminHomePage() {
  return (
    <main className="flex flex-1 flex-col bg-surface">
      <header className="flex h-14 items-center border-b bg-background px-4 sm:px-6">
        <Logo variant="horizontal" />
      </header>

      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-10 sm:px-6">
        <Card className="py-6 shadow-sm [--card-spacing:--spacing(6)]">
          <CardContent className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <Suspense fallback={<WelcomeSkeleton />}>
              <Welcome />
            </Suspense>
            <SignOutButton />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

async function Welcome() {
  // No repite la consulta: getCurrentUser usa cache() y el layout ya la hizo.
  const user = await getCurrentUser();
  if (!user?.isAdmin) return null;

  return (
    <div className="flex flex-col gap-1">
      <h1 className="text-2xl font-semibold tracking-tight">
        Bienvenido{user.fullName ? `, ${user.fullName.split(" ")[0]}` : ""}
      </h1>
      <p className="text-sm text-muted-foreground">
        Ingresaste como <span className="font-medium text-foreground">{user.email}</span>
      </p>
    </div>
  );
}

function WelcomeSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-2" aria-hidden>
      <div className="h-7 w-48 rounded bg-muted" />
      <div className="h-4 w-64 rounded bg-muted" />
    </div>
  );
}
