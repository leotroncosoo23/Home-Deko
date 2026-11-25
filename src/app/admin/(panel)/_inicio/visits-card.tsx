import Link from "next/link";
import { Eye, Footprints, Rocket, Users } from "lucide-react";
import { SectionCard } from "@/components/admin/section-card";
import { Badge } from "@/components/ui/badge";
import { changeBetween, type Period } from "@/lib/dashboard-period";
import { VISIT_SOURCE_LABELS } from "@/lib/visit-source";
import type { Dashboard } from "./data";
import { ChangeLabel, EmptyState, Thumb } from "./ui";

/**
 * Visitas de la tienda (contador propio, anónimo y sin cookies):
 *   - visitas del período y su variación;
 *   - conversión = pedidos ÷ visitas ("de cada 100 visitas, compran X");
 *   - de dónde vienen (Instagram, Google, directo…);
 *   - más vistos, marcando los que se miran mucho pero se venden poco
 *     (puede ser el precio, las fotos o la descripción).
 */

/** "Mucho interés, pocas ventas": 20 vistas o más y menos de 1 venta cada 20 vistas. */
const MIN_VIEWS_FOR_HINT = 20;
const lowSales = (views: number, units: number) => views >= MIN_VIEWS_FOR_HINT && units * 20 < views;

const pct = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 });
const int = (n: number) => n.toLocaleString("es-AR");

export function VisitsCard({ data, period }: { data: Dashboard; period: Period }) {
  const { current: c, previous: p } = data;

  if (!data.launched && c.visits === 0) {
    return (
      <SectionCard icon={Users} title="Visitas" description="Cuánta gente entra a la tienda y de dónde viene.">
        <EmptyState icon={Rocket} title="Las visitas se empiezan a contar cuando se lance la tienda">
          Se cuentan de forma anónima: sin cookies ni datos personales de nadie.
        </EmptyState>
      </SectionCard>
    );
  }

  const conversion = c.visits > 0 ? (c.orders / c.visits) * 100 : null;
  const maxSource = Math.max(1, ...data.sources.map((s) => s.visits));

  return (
    <SectionCard icon={Users} title="Visitas" description="Cuánta gente entra a la tienda y de dónde viene. Anónimo y sin cookies.">
      <div className="flex flex-col gap-6">
        {/* Números */}
        <dl className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1 rounded-lg bg-muted/50 p-3">
            <dt className="text-sm text-muted-foreground">Visitas</dt>
            <dd className="text-2xl font-semibold tracking-tight tabular-nums">{int(c.visits)}</dd>
            <dd>
              <ChangeLabel change={changeBetween(c.visits, p.visits)} compareLabel={period.compareLabel} />
            </dd>
          </div>
          <div className="flex flex-col gap-1 rounded-lg bg-muted/50 p-3">
            <dt className="text-sm text-muted-foreground">Conversión</dt>
            <dd className="text-2xl font-semibold tracking-tight tabular-nums">
              {conversion === null ? "—" : `${pct.format(conversion)} %`}
            </dd>
            <dd className="text-xs text-muted-foreground">
              {conversion === null
                ? "pedidos ÷ visitas"
                : `${int(c.orders)} ${c.orders === 1 ? "pedido" : "pedidos"} de ${int(c.visits)} ${c.visits === 1 ? "visita" : "visitas"}`}
            </dd>
          </div>
        </dl>

        {c.visits === 0 ? (
          <EmptyState icon={Footprints} title="Todavía no hay visitas en este período" className="py-4" />
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {/* De dónde vienen: barras horizontales, una sola tinta */}
            <section aria-labelledby="origenes" className="flex flex-col gap-3">
              <h3 id="origenes" className="text-sm font-medium">
                De dónde vienen
              </h3>
              <ul className="flex flex-col gap-2.5">
                {data.sources.map((s) => (
                  <li key={s.source} className="flex flex-col gap-1 text-sm">
                    <span className="flex items-baseline justify-between gap-2">
                      <span>{VISIT_SOURCE_LABELS[s.source]}</span>
                      <span className="text-muted-foreground tabular-nums">
                        {int(s.visits)} · {pct.format((s.visits / c.visits) * 100)} %
                      </span>
                    </span>
                    <span aria-hidden className="h-2 overflow-hidden rounded-full bg-muted">
                      <span
                        className="block h-full rounded-full bg-brand"
                        style={{ width: `max(4px, ${(s.visits / maxSource) * 100}%)` }}
                      />
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            {/* Más vistos */}
            <section aria-labelledby="mas-vistos" className="flex flex-col gap-3">
              <h3 id="mas-vistos" className="text-sm font-medium">
                Productos más vistos
              </h3>
              {data.topViewed.length === 0 ? (
                <p className="text-sm text-muted-foreground">Todavía nadie abrió un producto en este período.</p>
              ) : (
                <ol className="-mx-2 flex flex-col">
                  {data.topViewed.map((v) => (
                    <li key={v.productId}>
                      <Link
                        href={`/admin/productos/${v.productId}`}
                        className="flex items-center gap-3 rounded-md px-2 py-1.5 text-sm transition-colors outline-none hover:bg-muted/50 focus-visible:bg-muted/60"
                      >
                        <Thumb path={v.imagePath} />
                        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span className="truncate font-medium">{v.name}</span>
                          <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground tabular-nums">
                            <span className="inline-flex items-center gap-1">
                              <Eye className="size-3" aria-hidden />
                              {v.views === 1 ? "1 vista" : `${int(v.views)} vistas`}
                            </span>
                            <span>{v.units === 1 ? "1 vendido" : `${int(v.units)} vendidos`}</span>
                            {lowSales(v.views, v.units) && (
                              <Badge variant="secondary" className="h-auto py-0">
                                Mucho interés, pocas ventas
                              </Badge>
                            )}
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>
        )}
      </div>
    </SectionCard>
  );
}
