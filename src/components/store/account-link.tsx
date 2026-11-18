import Link from "next/link";
import { ChevronRight, LayoutDashboard, UserRound } from "lucide-react";
import { cn } from "cn";
import { getStoreViewer } from "@/lib/store-viewer";

/**
 * Botón de cuenta de la tienda:
 *   - sin sesión         → "Ingresá"   → /mi-cuenta
 *   - cliente con sesión → "Mi cuenta" → /mi-cuenta
 *   - admin              → "Panel"     → /admin  (en "Ver como cliente": como un visitante)
 *
 * Variantes:
 *   - "text": encabezado de escritorio (ícono + texto)
 *   - "icon": encabezado del celular (solo el ícono de persona)
 *   - "menu": fila dentro del menú hamburguesa ("Mi cuenta" o "Panel")
 *
 * Lee la sesión → va dentro de <Suspense> (fallback: AccountLinkFallback).
 */
type Variant = "text" | "icon" | "menu";

export async function AccountLink({ variant }: { variant: Variant }) {
  const viewer = await getStoreViewer();
  if (viewer.seesAdminView) return <AccountLinkView variant={variant} href="/admin" label="Panel" admin />;
  // "Ver como cliente": exactamente como un visitante.
  if (viewer.customerView) return <AccountLinkFallback variant={variant} />;
  return <AccountLinkView variant={variant} href="/mi-cuenta" label={labelFor(variant, viewer.hasSession)} />;
}

/** Lo que se ve mientras se lee la sesión (lo más común: un visitante). */
export function AccountLinkFallback({ variant }: { variant: Variant }) {
  return <AccountLinkView variant={variant} href="/mi-cuenta" label={labelFor(variant, false)} />;
}

/** En el menú siempre "Mi cuenta" (es un título de sección, no una invitación). */
function labelFor(variant: Variant, hasSession: boolean) {
  if (variant === "menu") return "Mi cuenta";
  return hasSession ? "Mi cuenta" : "Ingresá";
}

function AccountLinkView({
  variant,
  href,
  label,
  admin,
}: {
  variant: Variant;
  href: string;
  label: string;
  admin?: boolean;
}) {
  const Icon = admin ? LayoutDashboard : UserRound;

  if (variant === "icon") {
    return (
      <Link
        href={href}
        aria-label={label}
        className="inline-flex size-10 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/20 focus-visible:outline-none"
      >
        <Icon aria-hidden className="size-[22px]" />
      </Link>
    );
  }

  if (variant === "menu") {
    return (
      <Link href={href} className="flex items-center gap-3 rounded-xl px-3 py-3 font-medium transition-colors hover:bg-muted">
        <span className="flex size-10 items-center justify-center rounded-full bg-muted text-foreground">
          <Icon className="size-5" aria-hidden />
        </span>
        {label}
        <ChevronRight className="ml-auto size-4 text-muted-foreground" aria-hidden />
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className={cn(
        "inline-flex h-10 items-center gap-2 rounded-full px-3 text-sm font-medium transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/20 focus-visible:outline-none",
      )}
    >
      <Icon aria-hidden className="size-5" />
      {label}
    </Link>
  );
}
