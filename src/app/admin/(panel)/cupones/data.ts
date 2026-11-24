import "server-only";
import { requireAdmin } from "@/lib/auth";
import type { CouponKind, CouponStatus } from "@/lib/coupons";
import { createClient } from "@/lib/supabase/server";
import type { Coupon } from "./types";

/** Orden de la lista: primero los que están funcionando. */
const STATUS_ORDER: Record<CouponStatus, number> = {
  active: 0,
  scheduled: 1,
  paused: 2,
  exhausted: 3,
  expired: 4,
};

/**
 * Todos los cupones con sus usos y el total descontado (vista admin_coupons).
 * Solo para el panel: arranca con requireAdmin(). Por debajo, el RLS solo
 * deja leer a los admins. Llamarla dentro de <Suspense>.
 */
export async function getCoupons(): Promise<Coupon[]> {
  await requireAdmin();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("admin_coupons")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error("No se pudieron cargar los cupones.");

  return data
    .filter((c) => c.id && c.code && c.kind)
    .map((c) => ({
      id: c.id!,
      code: c.code!,
      kind: c.kind as CouponKind,
      value: c.value === null ? null : Number(c.value),
      startsOn: c.starts_on,
      endsOn: c.ends_on,
      maxUses: c.max_uses,
      onePerCustomer: c.one_per_customer ?? false,
      minPurchase: c.min_purchase === null ? null : Number(c.min_purchase),
      isActive: c.is_active ?? false,
      uses: c.uses ?? 0,
      totalDiscount: Number(c.total_discount ?? 0),
      overLimitUses: c.over_limit_uses ?? 0,
      everUsed: c.ever_used ?? false,
      status: (c.status ?? "paused") as CouponStatus,
    }))
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
}
