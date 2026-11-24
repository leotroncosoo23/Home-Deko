import { cn } from "cn";
import { buttonVariants } from "@/components/ui/button";
import { WhatsAppIcon } from "@/components/store/whatsapp-icon";

/** Abre WhatsApp con el mensaje ya escrito para el cliente. */
export function WhatsAppButton({ href, label, size = "default" }: { href: string; label: string; size?: "default" | "lg" }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(buttonVariants({ variant: "outline", size }), "w-fit bg-background")}
    >
      <WhatsAppIcon className="size-4 text-[#25D366]" />
      {label}
      <span className="sr-only"> (se abre en otra pestaña)</span>
    </a>
  );
}
