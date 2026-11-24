import type { CouponKind, CouponStatus } from "@/lib/coupons";

/** Un cupón tal como lo muestra el panel (vista admin_coupons). */
export type Coupon = {
  id: string;
  code: string;
  kind: CouponKind;
  /** percent: 1 a 100 · fixed: pesos · free_shipping: null */
  value: number | null;
  /** "AAAA-MM-DD" (día de Argentina) o null */
  startsOn: string | null;
  endsOn: string | null;
  maxUses: number | null;
  onePerCustomer: boolean;
  minPurchase: number | null;
  isActive: boolean;
  /** Usos vigentes (pedidos aprobados y no cancelados) */
  uses: number;
  /** Total descontado en esos pedidos */
  totalDiscount: number;
  /** Usos que entraron cuando ya no quedaban (se respetaron) */
  overLimitUses: number;
  /** Se usó alguna vez (aunque después se cancelara): no se borra ni cambia el código */
  everUsed: boolean;
  status: CouponStatus;
};

export type CouponField =
  | "code"
  | "kind"
  | "value"
  | "startsOn"
  | "endsOn"
  | "maxUses"
  | "minPurchase";

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Partial<Record<CouponField, string>> };
