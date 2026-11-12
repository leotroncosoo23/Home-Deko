import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Loader2, ShieldX } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: { default: "Panel", template: "%s · Panel Home Deko" },
  robots: { index: false, follow: false }, // que Google no indexe el panel
};

/**
 * Layout de TODO /admin: acá está el control de acceso de verdad.
 *
 *   sin sesión        → redirige a /login
 *   sesión, sin admin → "Tu cuenta no tiene acceso al panel"
 *   admin             → muestra la página pedida
 *
 * Va dentro de <Suspense> porque lee la sesión (cookies) en cada pedido.
 */
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <Suspense fallback={<AdminLoading />}>
      <AdminGate>{children}</AdminGate>
    </Suspense>
  );
}

async function AdminGate({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  if (!user) redirect("/login?next=/admin");

  if (!user.isAdmin) {
    return (
      <AuthShell>
        <Card className="py-6 shadow-sm [--card-spacing:--spacing(6)]">
          <CardContent className="flex flex-col items-center gap-4 text-center">
            <div className="flex size-11 items-center justify-center rounded-full bg-brand-soft">
              <ShieldX className="size-5 text-brand" aria-hidden />
            </div>
            <div className="flex flex-col gap-1.5">
              <h1 className="text-lg font-semibold">Tu cuenta no tiene acceso al panel</h1>
              <p className="text-sm text-muted-foreground">
                Iniciaste sesión como{" "}
                <span className="font-medium text-foreground">{user.email}</span>. Si sos parte
                de Home Deko, pedí que agreguen este email a la lista de administradores.
              </p>
            </div>
            <SignOutButton className="h-10 w-full" />
          </CardContent>
        </Card>
      </AuthShell>
    );
  }

  return <>{children}</>;
}

function AdminLoading() {
  return (
    <div className="flex flex-1 items-center justify-center bg-surface" role="status">
      <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden />
      <span className="sr-only">Cargando…</span>
    </div>
  );
}
