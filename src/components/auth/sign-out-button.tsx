"use client";

import { useFormStatus } from "react-dom";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signOut } from "@/app/auth/actions";

/**
 * Botón "Cerrar sesión". Es un <form> que llama a la Server Action signOut,
 * así funciona aunque JavaScript todavía no haya cargado.
 */
export function SignOutButton({
  variant = "outline",
  className,
}: {
  variant?: "default" | "outline" | "ghost";
  className?: string;
}) {
  return (
    <form action={signOut}>
      <SubmitButton variant={variant} className={className} />
    </form>
  );
}

function SubmitButton({
  variant,
  className,
}: {
  variant: "default" | "outline" | "ghost";
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} size="lg" disabled={pending} className={className}>
      <LogOut data-icon="inline-start" />
      {pending ? "Cerrando sesión…" : "Cerrar sesión"}
    </Button>
  );
}
