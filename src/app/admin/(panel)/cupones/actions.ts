"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { couponFormSchema } from "@/lib/coupon-schema";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult, CouponField } from "./types";

/**
 * Server Actions de Cupones.
 *
 * Reglas para TODAS:
 *   1. Arrancan con requireAdmin().
 *   2. No confían en el navegador: vuelven a validar todo acá.
 *   3. Escriben SOLO con las funciones de la base (save_coupon,
 *      set_coupon_active, delete_coupon), que validan is_admin() otra vez.
 *   4. Terminan con refresh() para que la lista muestre lo nuevo.
 */

const GENERIC = "No se pudo guardar. Intentá de nuevo en unos segundos.";

/** Errores de la base → mensaje para los dueños (los HD4xx ya vienen escritos para ellos). */
function translate(error: { code?: string; message: string }): string {
  if (error.code?.startsWith("HD4")) return error.message;
  if (error.code === "42501") return "Tu cuenta no tiene permiso para cambiar cupones.";
  console.error("[cupones]", error.code, error.message);
  return GENERIC;
}

export async function saveCoupon(input: unknown): Promise<ActionResult> {
  await requireAdmin();

  const parsed = couponFormSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Partial<Record<CouponField, string>> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as CouponField | undefined;
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { ok: false, error: "Revisá los datos marcados.", fieldErrors };
  }
  const d = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.rpc("save_coupon", {
    p: {
      id: d.id ?? null,
      code: d.code,
      kind: d.kind,
      value: d.value,
      starts_on: d.startsOn,
      ends_on: d.endsOn,
      max_uses: d.maxUses,
      one_per_customer: d.onePerCustomer,
      min_purchase: d.minPurchase,
      is_active: d.isActive,
    },
  });
  if (error) {
    const message = translate(error);
    // "Ya hay un cupón con el código…" va debajo del campo del código
    if (error.code === "HD409" && message.includes("código")) {
      return { ok: false, error: message, fieldErrors: { code: message } };
    }
    return { ok: false, error: message };
  }

  refresh();
  return { ok: true };
}

export async function setCouponActive(id: string, active: boolean): Promise<ActionResult> {
  await requireAdmin();
  if (!z.uuid().safeParse(id).success) return { ok: false, error: GENERIC };

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_coupon_active", { p_id: id, p_active: active === true });
  if (error) return { ok: false, error: translate(error) };

  refresh();
  return { ok: true };
}

export async function deleteCoupon(id: string): Promise<ActionResult> {
  await requireAdmin();
  if (!z.uuid().safeParse(id).success) return { ok: false, error: GENERIC };

  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_coupon", { p_id: id });
  if (error) return { ok: false, error: translate(error) };

  refresh();
  return { ok: true };
}
