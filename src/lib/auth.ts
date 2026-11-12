import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type CurrentUser = {
  id: string;
  email: string;
  fullName: string | null;
  isAdmin: boolean;
};

/**
 * Devuelve el usuario logueado (o null), con su rol.
 *
 * - getClaims() verifica la firma del token de sesión: no alcanza con que
 *   "exista una cookie", tiene que ser un token válido emitido por Supabase.
 * - El rol se lee de la tabla profiles. El RLS deja que cada usuario lea
 *   solo su propio perfil, así que esto funciona con la clave pública.
 * - cache() de React: si en una misma página lo llaman el layout y la
 *   página, la consulta a la base se hace una sola vez.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) return null;

  const claims = data.claims;

  const { data: profile } = await supabase
    .from("profiles")
    .select("email, full_name, role")
    .eq("id", claims.sub)
    .maybeSingle();

  return {
    id: claims.sub,
    email: profile?.email ?? claims.email ?? "",
    fullName: profile?.full_name ?? null,
    isAdmin: profile?.role === "admin",
  };
});

/**
 * Verificación de admin para los DATOS del panel. Usarla:
 *   - al principio de cada Server Action del panel (guardar, ajustar stock…)
 *   - en cada componente/función que lea datos del panel (dentro de <Suspense>)
 *
 * Esquema de seguridad del panel:
 *   1. src/proxy.ts → redirige según el rol del token (rápido, puede tener
 *      hasta ~1 h de atraso).
 *   2. requireAdmin() → lee el rol de la BASE en el momento.
 *   3. RLS en la base → la última barrera, aunque todo lo demás fallara.
 *
 * El layout de /admin NO controla el acceso: un layout no impide que la
 * página se ejecute, y si "esconde" la página, Next no puede pre-armarla.
 */
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin");
  if (!user.isAdmin) throw new Error("Tu cuenta no tiene acceso al panel.");
  return user;
}
