"use client";

import { useTransition } from "react";
import { ChevronDown, Loader2, LogOut } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut } from "@/app/auth/actions";

/** Iniciales para el círculo: "Leo Troncoso" → "LT"; sin nombre, del email. */
function initials(name: string | null, email: string): string {
  const source = name?.trim() || email.split("@")[0];
  const parts = source.split(/[\s._-]+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[1][0] : source.slice(0, 2);
  return letters.toUpperCase();
}

export function UserMenuDropdown({ name, email }: { name: string | null; email: string }) {
  const [pending, startTransition] = useTransition();
  const displayName = name?.trim() || email;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex items-center gap-2 rounded-full py-1 pr-2 pl-1 text-sm outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 data-popup-open:bg-muted"
        aria-label="Menú de la cuenta"
      >
        <Avatar className="size-8">
          <AvatarFallback className="bg-neutral-900 text-xs font-medium text-white">
            {initials(name, email)}
          </AvatarFallback>
        </Avatar>
        <span className="hidden max-w-40 truncate font-medium sm:inline">{displayName}</span>
        <ChevronDown className="size-4 text-muted-foreground" aria-hidden />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" sideOffset={6} className="w-60">
        <DropdownMenuGroup>
          {/* Nombre y email (no es una opción clickeable) */}
          <div className="px-2 py-1.5">
            {name && <p className="truncate text-sm font-medium">{name}</p>}
            <p className="truncate text-xs text-muted-foreground">{email}</p>
          </div>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={pending}
          // Llama a la Server Action signOut (borra la sesión y va a /login)
          onClick={() => startTransition(() => signOut())}
          className="px-2 py-1.5"
        >
          {pending ? <Loader2 className="animate-spin" /> : <LogOut />}
          {pending ? "Cerrando sesión…" : "Cerrar sesión"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
