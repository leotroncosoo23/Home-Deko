"use client";

import { useState, useTransition } from "react";
import { CreditCard, Loader2, PlugZap } from "lucide-react";
import { SectionCard } from "@/components/admin/section-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { testPaymentConnection, type ConnectionResult } from "../payment-actions";

export type GetnetStatus = {
  /** Medio de pago activo (PAYMENT_PROVIDER). */
  activeProvider: string;
  credentialsLoaded: boolean;
  /** Nombres de las variables que faltan (nunca valores). */
  missing: string[];
  env: string | null;
  webhookUrl: string | null;
};

/**
 * "Estado de Getnet" — solo para el desarrollador. Muestra si las
 * credenciales están cargadas (sí/no, nunca los valores), el ambiente y la
 * URL del webhook para cargar en el portal de Getnet. "Probar conexión" solo
 * pide un token: no cobra nada.
 */
export function GetnetStatusCard({ status }: { status: GetnetStatus }) {
  const [result, setResult] = useState<ConnectionResult | null>(null);
  const [pending, startTransition] = useTransition();

  function probe() {
    setResult(null);
    startTransition(async () => {
      try {
        setResult(await testPaymentConnection());
      } catch {
        setResult({ ok: false, error: "No se pudo probar. Revisá tu conexión e intentá de nuevo." });
      }
    });
  }

  return (
    <SectionCard
      icon={CreditCard}
      title="Estado de Getnet"
      description="Solo la ves vos (desarrollador). No muestra credenciales."
      contentClassName="flex flex-col gap-3 text-sm"
    >
      <dl className="flex flex-col gap-2">
        <Row label="Medio de pago activo">
          <span className="font-medium">{status.activeProvider}</span>
        </Row>
        <Row label="Credenciales">
          {status.credentialsLoaded ? (
            <Badge className="bg-emerald-50 text-emerald-700">Cargadas</Badge>
          ) : (
            <Badge className="bg-amber-50 text-amber-800">Faltan</Badge>
          )}
        </Row>
        {!status.credentialsLoaded && status.missing.length > 0 && (
          <p className="text-xs text-muted-foreground">Faltan: {status.missing.join(", ")}.</p>
        )}
        <Row label="Ambiente">{status.env ?? "—"}</Row>
        {status.webhookUrl && (
          <Row label="URL del webhook">
            <span className="font-mono text-xs break-all">{status.webhookUrl}</span>
          </Row>
        )}
      </dl>
      <div className="flex flex-wrap items-center gap-3 border-t pt-3">
        <Button type="button" variant="outline" size="sm" onClick={probe} disabled={pending || !status.credentialsLoaded}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <PlugZap className="size-4" aria-hidden />}
          Probar conexión
        </Button>
        {result && (
          <p role="status" className={result.ok ? "text-emerald-700" : "text-destructive"}>
            {result.ok ? result.message : result.error}
          </p>
        )}
      </div>
    </SectionCard>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}
