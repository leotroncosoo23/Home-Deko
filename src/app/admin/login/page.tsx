import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
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
 * /admin/login — ingreso SOLO del panel (los clientes entran en /mi-cuenta).
 * Está fuera del grupo (panel), así no lleva el menú del panel. El proxy la
 * deja pasar sin sesión y redirige el /login viejo hacia acá.
 *
 * La parte fija (fondo, logo, tarjeta) se muestra al instante. Lo que depende
 * de la sesión y de la URL (?next=, ?error=) va dentro de <Suspense>, porque
 * con cacheComponents todo lo que lee cookies o la URL se resuelve en cada pedido.
 */
export default function LoginPage(props: PageProps<"/admin/login">) {
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

      {/* Google pide que estas páginas estén enlazadas desde el inicio de sesión */}
      <nav
        aria-label="Páginas legales"
        className="mt-6 flex flex-wrap justify-center gap-x-2 text-xs text-muted-foreground"
      >
        <Link href="/privacidad" className="underline-offset-4 hover:text-foreground hover:underline">
          Política de privacidad
        </Link>
        <span aria-hidden>·</span>
        <Link href="/terminos" className="underline-offset-4 hover:text-foreground hover:underline">
          Términos y condiciones
        </Link>
      </nav>
    </AuthShell>
  );
}

async function LoginContent({ searchParams }: Pick<PageProps<"/admin/login">, "searchParams">) {
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
    <div className="flex animate-pulse flex-col gap-4" aria-hidden>
      <div className="h-10 rounded-lg bg-muted" />
      <div className="mx-auto h-3 w-3/4 rounded bg-muted" />
    </div>
  );
}
