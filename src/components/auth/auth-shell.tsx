import { Logo } from "@/components/brand/logo";

/**
 * Marco común de las pantallas de acceso (login, "sin acceso"):
 * fondo gris muy claro, logo apilado arriba y una tarjeta centrada.
 */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-surface px-4 py-12">
      <div className="w-full max-w-sm">
        <Logo variant="stacked" preload className="mx-auto mb-8 h-auto w-50" />
        {children}
      </div>
    </main>
  );
}
