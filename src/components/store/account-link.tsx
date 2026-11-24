import Link from "next/link";
import { ChevronRight, LayoutDashboard, UserRound } from "lucide-react";
import { cn } from "cn";
import { getMyAccount } from "@/lib/account";
import { firstNameOf } from "@/lib/format";
import { getStoreViewer } from "@/lib/store-viewer";

/**
 * Botón de cuenta de la tienda:
 *   - sin sesión         → "Ingresá"                      → /mi-cuenta
 *   - cliente con sesión → su primer nombre (o "Mi cuenta") → /mi-cuenta
 *   - admin              → "Panel"                        → /admin  (en "Ver como cliente": como un visitante)
 *
 * Variantes:
 *   - "text": encabezado de escritorio (ícono + texto)
 *   - "icon": encabezado del celular (solo el ícono de persona)
 *   - "menu": fila dentro del menú hamburguesa ("Mi cuenta", con el nombre abajo)
 *
 * Lee la sesión → va dentro de <Suspense> (fallback: AccountLinkFallback).
 */
type Variant = "text" | "icon" | "menu";

export async function AccountLink({ variant }: { variant: Variant }) {
  const viewer = await getStoreViewer();
  if (viewer.seesAdminView) return <AccountLinkView variant={variant} href="/admin" label="Panel" admin />;
  // "Ver como cliente": exactamente como un visitante.
  if (viewer.customerView) return <AccountLinkFallback variant={variant} />;
  if (!viewer.hasSession) return <AccountLinkFallback variant={variant} />;

  // Cliente logueado: el nombre de "Mis datos" (o el email en el menú).
  const account = await getMyAccount();
  const first = account?.details.name ? firstNameOf(account.details.name) : "";
  if (variant === "menu") {
    return (
      <AccountLinkView
        variant="menu"
        href="/mi-cuenta"
        label="Mi cuenta"
        detail={account?.details.name || account?.email || undefined}
      />
    );
  }
  return <AccountLinkView variant={variant} href="/mi-cuenta" label={variant === "text" && first ? first : "Mi cuenta"} />;
}

/** Lo que se ve mientras se lee la sesión (lo más común: un visitante). */
export function AccountLinkFallback({ variant }: { variant: Variant }) {
  // En el menú siempre "Mi cuenta" (es un título de sección, no una invitación).
  return <AccountLinkView variant={variant} href="/mi-cuenta" label={variant === "menu" ? "Mi cuenta" : "Ingresá"} />;
}

function AccountLinkView({
  variant,
  href,
  label,
  detail,
  admin,
}: {
  variant: Variant;
  href: string;
  label: string;
  /** Solo en el menú: el nombre o el email de la cuenta, debajo del título. */
  detail?: string;
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
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
          <Icon className="size-5" aria-hidden />
        </span>
        <span className="flex min-w-0 flex-col">
          {label}
          {detail && <span className="truncate text-sm font-normal text-muted-foreground">{detail}</span>}
        </span>
        <ChevronRight className="ml-auto size-4 shrink-0 text-muted-foreground" aria-hidden />
      </Link>
    );
  }

  return (
    <Link
      href={href}
      aria-label={label === "Ingresá" || label === "Panel" || label === "Mi cuenta" ? undefined : `Mi cuenta (${label})`}
      className={cn(
        "inline-flex h-10 max-w-48 items-center gap-2 rounded-full px-3 text-sm font-medium transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/20 focus-visible:outline-none",
      )}
    >
      <Icon aria-hidden className="size-5 shrink-0" />
      <span className="truncate">{label}</span>
    </Link>
  );
}
