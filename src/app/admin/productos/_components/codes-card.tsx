import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { VariantCode } from "../types";

/**
 * Códigos de cada variante (al editar): SKU y código de barras EAN-13
 * que generó la base. Los códigos de barras nunca cambian.
 */
export function CodesCard({ codes }: { codes: VariantCode[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Códigos</CardTitle>
        <CardDescription>El código de barras es fijo: se puede imprimir tranquilo.</CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        <ul className="divide-y border-t text-sm">
          {codes.map((c) => (
            <li key={c.id} className="flex flex-col gap-0.5 px-(--card-spacing) py-2.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate font-medium">{c.label}</span>
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">Stock {c.stock}</span>
              </div>
              <span className="font-mono text-sm tracking-wide tabular-nums">{c.barcode}</span>
              <span className="font-mono text-xs text-muted-foreground">{c.sku ? `SKU ${c.sku}` : "Sin SKU"}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
