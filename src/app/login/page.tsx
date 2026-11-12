import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AuthShell } from "@/components/auth/auth-shell";
import { getCurrentUser } from "@/lib/auth";
import { safeNext } from "@/lib/redirects";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Ingresar" };

const ERRORS: Record<string, string> = {
  google: "No se pudo iniciar sesión con Google. Probá de nuevo.",
  callback: "El link venció o ya se usó, o se canceló el ingreso. Probá de nuevo.",
};

/**
 * /login
 *
 * La parte fija (fondo, logo, tarjeta) se muestra al instante. Lo que depende
 * de la sesión y de la URL (?next=, ?error=) va dentro de <Suspense>, porque
 * con cacheComponents todo lo que lee cookies o la URL se resuelve en cada pedido.
 */
export default function LoginPage(props: PageProps<"/login">) {
  return (
    <AuthShell>
      <Card className="gap-6 py-6 shadow-sm [--card-spacing:--spacing(6)]">
        <CardHeader className="text-center">
          <CardTitle className="text-lg font-semibold">Ingresá a tu cuenta</CardTitle>
          <CardDescription>Panel de administración de Home Deko</CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<LoginFormSkeleton />}>
            <LoginContent searchParams={props.searchParams} />
          </Suspense>
        </CardContent>
      </Card>
    </AuthShell>
  );
}

async function LoginContent({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const params = await searchParams;
  const next = safeNext(typeof params.next === "string" ? params.next : null);
  const errorKey = typeof params.error === "string" ? params.error : undefined;

  const user = await getCurrentUser();

  // Un admin que ya inició sesión no necesita ver el login
  if (user?.isAdmin) redirect(next);

  // Ya inició sesión, pero su cuenta no es admin
  if (user) redirect("/sin-acceso");

  return <LoginForm next={next} initialError={errorKey ? ERRORS[errorKey] : undefined} />;
}

function LoginFormSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-5" aria-hidden>
      <div className="h-10 rounded-lg bg-muted" />
      <div className="h-px bg-muted" />
      <div className="h-10 rounded-lg bg-muted" />
      <div className="h-10 rounded-lg bg-muted" />
      <div className="h-10 rounded-lg bg-muted" />
    </div>
  );
}
