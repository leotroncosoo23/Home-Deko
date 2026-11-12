import { getCurrentUser } from "@/lib/auth";
import { UserMenuDropdown } from "./user-menu-dropdown";

/**
 * Menú del usuario (arriba a la derecha).
 *
 * Esta parte corre en el servidor y lee quién es el usuario. Como lee la
 * sesión, el layout la pone dentro de <Suspense>: el resto del panel se
 * muestra al instante y esto aparece apenas llega el dato.
 */
export async function UserMenu() {
  const user = await getCurrentUser();
  if (!user) return null;

  return <UserMenuDropdown name={user.fullName} email={user.email} />;
}

/** Lo que se ve mientras carga: un círculo y una línea gris. */
export function UserMenuSkeleton() {
  return (
    <div className="flex animate-pulse items-center gap-2" aria-hidden>
      <div className="size-8 rounded-full bg-muted" />
      <div className="hidden h-4 w-24 rounded bg-muted sm:block" />
    </div>
  );
}
