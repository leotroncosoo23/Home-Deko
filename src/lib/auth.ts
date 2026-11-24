import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
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
  if (!user) redirect("/admin/login?next=/admin");
  if (!user.isAdmin) throw new Error("Tu cuenta no tiene acceso al panel.");
  return user;
}

// ---------------------------------------------------------------------------
// Secciones reservadas (hoy: "Apariencia de la tienda", solo para el desarrollador)
// ---------------------------------------------------------------------------

/** A qué secciones reservadas puede entrar el usuario. */
export type PanelAccess = {
  /** "Apariencia de la tienda": barra de anuncios y Banner. */
  appearance: boolean;
};

/**
 * Lo decide la BASE: can_manage_appearance() (migración apariencia_tienda),
 * la misma función que usa el RLS de banners y store_announcements. Para
 * habilitarles la sección a los dueños se cambia esa función; la app no se toca.
 *
 * cache() de React: el menú, la página y la ayuda preguntan una sola vez.
 * Lee la sesión → llamarla dentro de <Suspense>.
 */
export const getPanelAccess = cache(async (): Promise<PanelAccess> => {
  const user = await getCurrentUser();
  if (!user?.isAdmin) return { appearance: false };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("can_manage_appearance");
  return { appearance: !error && data === true };
});

/**
 * Para "Apariencia de la tienda" (páginas y datos). Si el usuario no puede
 * usarla, para él la sección "no existe": notFound().
 */
export async function requireAppearanceAccess(): Promise<CurrentUser> {
  const user = await requireAdmin();
  const access = await getPanelAccess();
  if (!access.appearance) notFound();
  return user;
}
