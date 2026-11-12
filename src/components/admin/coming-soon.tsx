import type { LucideIcon } from "lucide-react";

/** Tarjeta provisoria para las secciones que todavía no están hechas. */
export function ComingSoon({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-background px-6 py-16 text-center">
      <div className="flex size-11 items-center justify-center rounded-full bg-brand-soft">
        <Icon className="size-5 text-brand" aria-hidden />
      </div>
      <div className="flex flex-col gap-1">
        <p className="font-medium">Próximamente</p>
        <p className="max-w-sm text-sm text-muted-foreground">{text}</p>
      </div>
    </div>
  );
}
