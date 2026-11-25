import "server-only";
import { cache } from "react";
import { getCurrentUser, requireAdmin } from "@/lib/auth";
import { titleCase } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { TABS, timeAgo, type WithdrawalStatus, type WithdrawalTab } from "./status";

/**
 * Lecturas de las solicitudes del Botón de arrepentimiento (con la sesión
 * del admin: el RLS deja verlas solo a los admins).
 */

export type WithdrawalRow = {
  id: string;
  code: string;
  fullName: string;
  email: string;
  orderNumber: number | null;
  orderId: string | null;
  status: WithdrawalStatus;
  createdAt: string;
  /** "hace 3 horas" (se calcula al leer: la página es dinámica). */
  receivedAgo: string;
};

export type WithdrawalCounts = Record<WithdrawalTab, number>;

const LIST_LIMIT = 200;

export async function getWithdrawals(tab: WithdrawalTab): Promise<WithdrawalRow[]> {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("withdrawal_requests")
    .select("id, code, full_name, email, order_number, order_id, status, created_at")
    .in("status", [...TABS[tab].statuses])
    // Nuevas y en gestión: la más vieja primero (es la más urgente). Cerradas y todas: la más nueva primero.
    .order("created_at", { ascending: tab === "nuevas" || tab === "gestion" })
    .limit(LIST_LIMIT);
  if (error) throw new Error("No se pudieron leer las solicitudes.");
  const now = Date.now();
  return data.map((r) => ({
    id: r.id,
    code: r.code,
    fullName: titleCase(r.full_name),
    email: r.email,
    orderNumber: r.order_number,
    orderId: r.order_id,
    status: r.status as WithdrawalStatus,
    createdAt: r.created_at,
    receivedAgo: timeAgo(r.created_at, now),
  }));
}

export async function getWithdrawalCounts(): Promise<WithdrawalCounts> {
  await requireAdmin();
  const supabase = await createClient();
  // Son pocas filas: alcanza con traer el estado de todas y contar acá.
  const { data, error } = await supabase.from("withdrawal_requests").select("status");
  if (error) throw new Error("No se pudieron contar las solicitudes.");
  const by = (s: WithdrawalStatus) => data.filter((r) => r.status === s).length;
  return {
    nuevas: by("new"),
    gestion: by("in_progress"),
    cerradas: by("resolved") + by("rejected"),
    todas: data.length,
  };
}

/** Contador del menú: solicitudes nuevas (0 si no es admin, como los demás contadores). */
export const getNewWithdrawalsCount = cache(async (): Promise<number> => {
  const user = await getCurrentUser();
  if (!user?.isAdmin) return 0;
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("withdrawal_requests")
    .select("id", { count: "exact", head: true })
    .eq("status", "new");
  return error ? 0 : (count ?? 0);
});

export type WithdrawalDetail = WithdrawalRow & {
  reason: string | null;
  adminNote: string | null;
  handledByName: string | null;
  handledAt: string | null;
  customerEmailSentAt: string | null;
  ownersEmailSentAt: string | null;
  /** Pasaron más de 5 minutos y el mail con el código al cliente no salió. */
  customerEmailMissing: boolean;
  /** Del pedido vinculado (si el número y el email coincidieron). */
  order: { number: number; phone: string; createdAt: string; total: number } | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getWithdrawalDetail(id: string): Promise<WithdrawalDetail | null> {
  await requireAdmin();
  if (!UUID.test(id)) return null;
  const supabase = await createClient();
  const { data: r, error } = await supabase
    .from("withdrawal_requests")
    .select(
      "id, code, full_name, email, order_number, order_id, status, created_at, reason, admin_note, handled_by_name, handled_at, customer_email_sent_at, owners_email_sent_at",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("No se pudo leer la solicitud.");
  if (!r) return null;

  let order: WithdrawalDetail["order"] = null;
  if (r.order_id) {
    const { data: o } = await supabase
      .from("orders")
      .select("order_number, customer_phone, created_at, total")
      .eq("id", r.order_id)
      .maybeSingle();
    if (o) order = { number: o.order_number, phone: o.customer_phone, createdAt: o.created_at, total: Number(o.total) };
  }

  const now = Date.now();
  return {
    id: r.id,
    code: r.code,
    fullName: titleCase(r.full_name),
    email: r.email,
    orderNumber: r.order_number,
    orderId: r.order_id,
    status: r.status as WithdrawalStatus,
    createdAt: r.created_at,
    receivedAgo: timeAgo(r.created_at, now),
    customerEmailMissing: !r.customer_email_sent_at && now - new Date(r.created_at).getTime() > 5 * 60_000,
    reason: r.reason,
    adminNote: r.admin_note,
    handledByName: r.handled_by_name,
    handledAt: r.handled_at,
    customerEmailSentAt: r.customer_email_sent_at,
    ownersEmailSentAt: r.owners_email_sent_at,
    order,
  };
}
