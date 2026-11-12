import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { getCurrentUser } from "@/lib/auth";
import { refreshSessionAndEnter } from "./actions";

export const metadata: Metadata = {
  title: "Sin acceso",
  robots: { index: false, follow: false },
};

/**
 * /sin-acceso — a donde el proxy manda a quien entra a /admin sin rol admin.
 */
export default function NoAccessPage() {
  return (
    <AuthShell>
      <Card className="py-6 shadow-sm [--card-spacing:--spacing(6)]">
        <CardContent className="flex flex-col items-center gap-4 text-center">
          <Suspense fallback={<NoAccessSkeleton />}>
            <NoAccessContent />
          </Suspense>
        </CardContent>
      </Card>
    </AuthShell>
  );
}

async function NoAccessContent() {
  // Acá el rol se lee de la BASE (no del token): es el dato actualizado.
  const user = await getCurrentUser();

  if (!user) redirect("/login");

  // El token decía "no admin", pero la base dice que sí: token viejo.
  if (user.isAdmin) {
    return (
      <>
        <h1 className="text-lg font-semibold">Tu acceso se actualizó</h1>
        <p className="text-sm text-muted-foreground">
          Tu cuenta ya tiene acceso al panel. Hacé clic para entrar.
        </p>
        <form action={refreshSessionAndEnter} className="w-full">
          <Button type="submit" size="lg" className="h-10 w-full">
            Entrar al panel
            <ArrowRight data-icon="inline-end" />
          </Button>
        </form>
      </>
    );
  }

  return (
    <>
      <div className="flex size-11 items-center justify-center rounded-full bg-brand-soft">
        <ShieldX className="size-5 text-brand" aria-hidden />
      </div>
      <div className="flex flex-col gap-1.5">
        <h1 className="text-lg font-semibold">Tu cuenta no tiene acceso al panel</h1>
        <p className="text-sm text-muted-foreground">
          Iniciaste sesión como <span className="font-medium text-foreground">{user.email}</span>.
          Si sos parte de Home Deko, pedí que agreguen este email a la lista de administradores.
        </p>
      </div>
      <SignOutButton className="h-10 w-full" />
      <Link href="/" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
        Ir a la tienda
      </Link>
    </>
  );
}

function NoAccessSkeleton() {
  return (
    <div className="flex w-full animate-pulse flex-col items-center gap-4" aria-hidden>
      <div className="size-11 rounded-full bg-muted" />
      <div className="h-5 w-3/4 rounded bg-muted" />
      <div className="h-10 w-full rounded bg-muted" />
      <div className="h-10 w-full rounded-lg bg-muted" />
    </div>
  );
}
