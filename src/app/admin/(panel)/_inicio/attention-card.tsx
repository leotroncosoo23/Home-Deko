import Link from "next/link";
import {
  AlertTriangle,
  BellRing,
  CircleCheck,
  PackageOpen,
  PackageX,
  Settings,
  TrendingDown,
  Undo2,
} from "lucide-react";
import { cn } from "cn";
import { SectionCard } from "@/components/admin/section-card";
import { buttonVariants } from "@/components/ui/button";
import type { Attention } from "./data";

/**
 * "Requiere atención": arriba de todo, cada aviso con su botón directo.
 * Colores como en el resto del panel: rojo = urgente (pagado sin stock, sin
 * stock) · ámbar = hay que hacer algo · gris = recordatorio.
 * Sin nada pendiente: "Todo al día".
 */

type Tone = "red" | "amber" | "soft";
type Item = { key: string; icon: typeof PackageX; tone: Tone; text: React.ReactNode; href: string; action: string };

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many.replace("#", String(n)));

function joinWords(words: string[]): string {
  return words.length <= 1 ? (words[0] ?? "") : `${words.slice(0, -1).join(", ")} y ${words.at(-1)}`;
}

export function AttentionCard({ attention: a }: { attention: Attention }) {
  const items: Item[] = [];

  if (a.stockIssue > 0)
    items.push({
      key: "stock-issue",
      icon: PackageX,
      tone: "red",
      text: <strong className="font-semibold">{plural(a.stockIssue, "1 pedido pagado sin stock", "# pedidos pagados sin stock")}</strong>,
      href: "/admin/pedidos?estado=atencion",
      action: "Resolver",
    });
  if (a.needsReview > 0)
    items.push({
      key: "review",
      icon: AlertTriangle,
      tone: "amber",
      text: <strong className="font-semibold">{plural(a.needsReview, "1 pedido para revisar", "# pedidos para revisar")}</strong>,
      href: "/admin/pedidos?estado=atencion",
      action: "Revisar",
    });
  if (a.pendingWithdrawals > 0)
    items.push({
      key: "withdrawals",
      icon: Undo2,
      tone: "amber",
      text: (
        <>
          <strong className="font-semibold">
            {plural(a.pendingWithdrawals, "1 solicitud de arrepentimiento", "# solicitudes de arrepentimiento")}
          </strong>
          <span className="text-muted-foreground"> — contactá al cliente para coordinar la devolución.</span>
        </>
      ),
      href: "/admin/arrepentimientos",
      action: "Ver",
    });
  if (a.toPrepare > 0)
    items.push({
      key: "prepare",
      icon: PackageOpen,
      tone: "amber",
      text: (
        <>
          <strong className="font-semibold">{plural(a.toPrepare, "1 pedido para preparar", "# pedidos para preparar")}</strong>
          <span className="text-muted-foreground"> — ya están pagados.</span>
        </>
      ),
      href: "/admin/pedidos",
      action: "Preparar",
    });
  if (a.outOfStock > 0)
    items.push({
      key: "out",
      icon: PackageX,
      tone: "red",
      text: <strong className="font-semibold">{plural(a.outOfStock, "1 variante sin stock", "# variantes sin stock")}</strong>,
      href: "/admin/stock?reponer=sin",
      action: "Ver",
    });
  if (a.lowStock > 0)
    items.push({
      key: "low",
      icon: TrendingDown,
      tone: "amber",
      text: <strong className="font-semibold">{plural(a.lowStock, "1 variante con stock bajo", "# variantes con stock bajo")}</strong>,
      href: "/admin/stock?reponer=bajo",
      action: "Ver",
    });
  if (a.missingSettings.length > 0)
    items.push({
      key: "settings",
      icon: Settings,
      tone: "soft",
      text: (
        <>
          Falta cargar en Configuración: <strong className="font-semibold">{joinWords(a.missingSettings)}</strong>
          <span className="text-muted-foreground"> (van en los mails, el pie de la tienda y las páginas legales).</span>
        </>
      ),
      href: "/admin/configuracion",
      action: "Completar",
    });

  if (items.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
        <CircleCheck className="size-5 shrink-0" aria-hidden />
        <p>
          <strong className="font-semibold">Todo al día.</strong> No hay pedidos, solicitudes ni stock que necesiten
          atención.
        </p>
      </div>
    );
  }

  return (
    <SectionCard
      icon={BellRing}
      title="Requiere atención"
      description={plural(items.length, "Hay 1 cosa para resolver.", "Hay # cosas para resolver.")}
      contentClassName="p-0"
    >
      <ul className="divide-y">
        {items.map(({ key, icon: Icon, tone, text, href, action }) => (
          <li key={key} className="flex items-center gap-3 px-5 py-3 text-sm">
            <span
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-full",
                tone === "red" && "bg-brand-soft text-brand",
                tone === "amber" && "bg-amber-50 text-amber-700",
                tone === "soft" && "bg-secondary text-muted-foreground",
              )}
            >
              <Icon className="size-4" aria-hidden />
            </span>
            <p className="min-w-0 flex-1">{text}</p>
            <Link href={href} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "shrink-0")}>
              {action}
            </Link>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}
