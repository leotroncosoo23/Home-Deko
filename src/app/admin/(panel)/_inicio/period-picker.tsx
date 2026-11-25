import Form from "next/form";
import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { cn } from "cn";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PERIODS, periodHref, type Period, type PeriodKey } from "@/lib/dashboard-period";
import { LinkPending } from "./link-pending";

/**
 * Selector de período: un botón por período (links: el período vive en la
 * URL, así se puede recargar o compartir). "Personalizado" muestra dos
 * fechas (desde / hasta) con el calendario del celular o de la compu.
 * Debajo, el rango exacto ("1 nov. – 24 nov. 2026") en hora de Argentina.
 */
export function PeriodPicker({ period, today }: { period: Period; today: string }) {
  return (
    <div className="flex flex-col gap-3">
      <nav aria-label="Período" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="flex w-max gap-1.5 sm:w-auto sm:flex-wrap">
          {(Object.keys(PERIODS) as PeriodKey[]).map((key) => {
            const active = key === period.key;
            return (
              <li key={key}>
                <Link
                  href={periodHref(period, { periodo: key })}
                  prefetch={false}
                  scroll={false}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex h-8 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/20",
                    active
                      ? "border-foreground bg-foreground text-background"
                      : "bg-background text-foreground hover:bg-muted",
                  )}
                >
                  {PERIODS[key]}
                  <LinkPending />
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {period.key === "personalizado" && (
        // Formulario GET: cambia la URL a /admin?periodo=personalizado&desde=…&hasta=…
        <Form action="/admin" scroll={false} className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-3">
          <input type="hidden" name="periodo" value="personalizado" />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="desde">Desde</Label>
            <Input id="desde" name="desde" type="date" defaultValue={period.from} max={today} required className="w-40" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="hasta">Hasta</Label>
            <Input id="hasta" name="hasta" type="date" defaultValue={period.to} max={today} required className="w-40" />
          </div>
          <button type="submit" className={buttonVariants()}>
            Ver
          </button>
        </Form>
      )}

      <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <CalendarDays className="size-4" aria-hidden />
        <span>
          <span className="font-medium text-foreground">{period.label}</span>
          {period.key === "personalizado" && period.days > 1 && ` · ${period.days} días`}
        </span>
      </p>
    </div>
  );
}
