import Link from "next/link";
import { ChartColumn, Rocket } from "lucide-react";
import { cn } from "cn";
import { SectionCard } from "@/components/admin/section-card";
import { BUCKETS, periodHref, shortDay, type BucketKey, type Period } from "@/lib/dashboard-period";
import type { Dashboard, SeriesPoint } from "./data";
import { LinkPending } from "./link-pending";
import { EmptyState, money, moneyCompact } from "./ui";

/**
 * Gráfico de ventas: barras en rojo Home Deko, una por día, semana o mes.
 *
 * Se arma en el SERVIDOR con HTML y CSS (sin librerías ni JavaScript en el
 * navegador): carga al instante y se adapta solo al ancho del celular.
 *   - Al pasar el mouse (o tocar) una barra: fecha, monto y pedidos.
 *   - Arriba, el total y el mejor tramo (se lee sin tocar nada en el celular).
 *   - Tabla oculta para lectores de pantalla con todos los valores.
 * Sin ventas: un mensaje amable, nunca un gráfico vacío que parezca roto.
 */

const UNIT: Record<BucketKey, { title: string; best: string }> = {
  dia: { title: "Ventas por día", best: "Mejor día" },
  semana: { title: "Ventas por semana", best: "Mejor semana" },
  mes: { title: "Ventas por mes", best: "Mejor mes" },
};

const AR = "America/Argentina/Buenos_Aires";
const atNoon = (day: string) => new Date(`${day}T12:00:00-03:00`);

/** Texto corto debajo de la barra. */
function axisLabel(start: string, bucket: BucketKey): string {
  if (bucket === "mes") return atNoon(start).toLocaleDateString("es-AR", { month: "short", timeZone: AR });
  return shortDay(start, false);
}

/** Texto completo (tooltip, tabla y "mejor día"). */
function fullLabel(start: string, bucket: BucketKey): string {
  if (bucket === "dia")
    return atNoon(start).toLocaleDateString("es-AR", { weekday: "short", day: "numeric", month: "short", timeZone: AR });
  if (bucket === "semana") return `Semana del ${shortDay(start, false)}`;
  const text = atNoon(start).toLocaleDateString("es-AR", { month: "long", year: "numeric", timeZone: AR });
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Tope "redondo" del eje (1, 2, 2,5 o 5 × 10ⁿ) para que las líneas caigan en números fáciles. */
function niceCeil(value: number): number {
  if (value <= 0) return 1;
  const exp = 10 ** Math.floor(Math.log10(value));
  const f = value / exp;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return nice * exp;
}

const pedidos = (n: number) => (n === 1 ? "1 pedido" : `${n} pedidos`);

export function SalesChart({ data, period }: { data: Dashboard; period: Period }) {
  const unit = UNIT[period.bucket];
  const series = data.series;
  const total = series.reduce((sum, p) => sum + p.sales, 0);

  // Selector Día / Semana / Mes (solo las que tienen sentido para el período)
  const bucketLinks =
    period.buckets.length > 1 ? (
      <nav aria-label="Agrupar el gráfico" className="flex rounded-full border bg-background p-0.5">
        {period.buckets.map((b) => (
          <Link
            key={b}
            href={periodHref(period, { agrupar: b })}
            prefetch={false}
            scroll={false}
            aria-current={b === period.bucket ? "true" : undefined}
            className={cn(
              "inline-flex h-7 items-center gap-1 rounded-full px-3 text-xs font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/20",
              b === period.bucket ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {BUCKETS[b]}
            <LinkPending />
          </Link>
        ))}
      </nav>
    ) : null;

  let body: React.ReactNode;
  if (period.days === 1) {
    body = (
      <EmptyState icon={ChartColumn} title="El gráfico se arma con varios días">
        Elegí 7 días, 30 días o Este mes para ver cómo vienen las ventas.
      </EmptyState>
    );
  } else if (total === 0) {
    body = data.launched ? (
      <EmptyState icon={ChartColumn} title="No hubo ventas en este período">
        Cuando entren pedidos, cada venta aprobada se suma acá. Probá con un período más largo.
      </EmptyState>
    ) : (
      <EmptyState icon={Rocket} title="Acá vas a ver las ventas cuando se lance la tienda">
        Cada pedido pagado se suma solo, día por día.
      </EmptyState>
    );
  } else {
    body = <Bars series={series} bucket={period.bucket} />;
  }

  const best = total > 0 ? series.reduce((a, b) => (b.sales > a.sales ? b : a)) : null;

  return (
    <SectionCard
      icon={ChartColumn}
      title={unit.title}
      description={
        best ? (
          <>
            Total <span className="font-medium text-foreground tabular-nums">{money(total)}</span> · {unit.best}:{" "}
            {fullLabel(best.start, period.bucket)} ({money(best.sales)})
          </>
        ) : (
          "Solo ventas de la tienda online, con el pago aprobado."
        )
      }
      action={total > 0 ? bucketLinks : null}
    >
      {body}
    </SectionCard>
  );
}

function Bars({ series, bucket }: { series: SeriesPoint[]; bucket: BucketKey }) {
  const top = niceCeil(Math.max(...series.map((p) => p.sales)));
  const n = series.length;
  // Etiquetas de abajo: como mucho ~6, para que no se pisen en el celular
  const step = Math.max(1, Math.ceil(n / 6));

  return (
    <figure className="flex flex-col gap-2">
      <div className="relative h-48 sm:h-56">
        {/* Líneas guía (recesivas) con su valor a la izquierda */}
        {[1, 0.5, 0].map((f) => (
          <div
            key={f}
            aria-hidden
            className={cn("absolute inset-x-0 flex items-center gap-2", f === 0 ? "border-t border-border" : "border-t border-dashed border-border/70")}
            style={{ bottom: `${f * 100}%` }}
          >
            <span className="absolute -top-2.5 left-0 bg-card pr-1 text-[11px] leading-none text-muted-foreground tabular-nums">
              {f === 0 ? "" : moneyCompact(top * f)}
            </span>
          </div>
        ))}

        {/* Barras: cada columna completa es el área para pasar el mouse o tocar */}
        <div aria-hidden className="absolute inset-y-0 right-0 left-16 flex items-end gap-0.5">
          {series.map((p, i) => {
            const pct = (p.sales / top) * 100;
            const align = i < n / 3 ? "left-0" : i >= (2 * n) / 3 ? "right-0" : "left-1/2 -translate-x-1/2";
            return (
              <div key={p.start} tabIndex={-1} className="group relative flex h-full min-w-0 flex-1 items-end justify-center outline-none">
                <div
                  className="w-full max-w-10 rounded-t-[4px] bg-brand transition-[filter] group-hover:brightness-90 group-focus:brightness-90"
                  // Una venta chica igual se ve (mínimo 2 px)
                  style={{ height: p.sales > 0 ? `max(2px, ${pct}%)` : 0 }}
                />
                <div
                  role="tooltip"
                  className={cn(
                    "pointer-events-none absolute z-10 hidden rounded-md bg-foreground px-2 py-1 text-xs whitespace-nowrap text-background shadow-md group-hover:block group-focus:block",
                    align,
                  )}
                  style={{ bottom: `calc(${Math.min(pct, 100)}% + 6px)` }}
                >
                  <span className="block font-medium">{fullLabel(p.start, bucket)}</span>
                  <span className="tabular-nums">
                    {money(p.sales)} · {pedidos(p.orders)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Fechas debajo (una cada tanto) */}
      <div aria-hidden className="ml-16 flex gap-0.5">
        {series.map((p, i) => (
          <div key={p.start} className="relative h-4 min-w-0 flex-1">
            {i % step === 0 && (
              <span className="absolute top-0 left-1/2 -translate-x-1/2 text-[11px] whitespace-nowrap text-muted-foreground">
                {axisLabel(p.start, bucket)}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Para lectores de pantalla: todos los valores en una tabla */}
      <table className="sr-only">
        <caption>{UNIT[bucket].title}</caption>
        <thead>
          <tr>
            <th scope="col">Fecha</th>
            <th scope="col">Ventas</th>
            <th scope="col">Pedidos</th>
          </tr>
        </thead>
        <tbody>
          {series.map((p) => (
            <tr key={p.start}>
              <th scope="row">{fullLabel(p.start, bucket)}</th>
              <td>{money(p.sales)}</td>
              <td>{p.orders}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
