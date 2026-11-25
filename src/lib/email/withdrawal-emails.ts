import "server-only";
import { formatArgentinaDateTime } from "@/lib/dates";
import { titleCase } from "@/lib/format";
import { siteUrl } from "@/lib/site-url";
import { getStoreSettings, ownersEmail, whatsappLink } from "@/lib/store-settings";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "./send";
import {
  withdrawalOwnersEmail,
  withdrawalReceivedEmail,
  type EmailLinks,
  type EmailWithdrawal,
} from "./templates";

/**
 * Mails de una solicitud del Botón de arrepentimiento:
 *   - al CLIENTE: "Recibimos tu solicitud" con el código (Disp. 954/2025, art. 5:
 *     el código se informa por el mismo medio; además lo ve en pantalla).
 *   - a los DUEÑOS: "Nueva solicitud" con el botón al panel.
 *
 * Se llama con after() (después de responder). NUNCA tira error: lo que falle
 * queda en la consola y el panel muestra si el mail al cliente salió
 * (customer_email_sent_at / owners_email_sent_at).
 */
export async function sendWithdrawalEmails(withdrawalId: string): Promise<void> {
  try {
    const supabase = createAdminClient();
    const [{ data: row }, settings] = await Promise.all([
      supabase
        .from("withdrawal_requests")
        .select("id, code, full_name, email, order_number, order_id, reason, created_at")
        .eq("id", withdrawalId)
        .maybeSingle(),
      getStoreSettings(),
    ]);
    if (!row) {
      console.warn("[email] solicitud de arrepentimiento inexistente", withdrawalId);
      return;
    }

    const w: EmailWithdrawal = {
      id: row.id,
      code: row.code,
      fullName: titleCase(row.full_name),
      email: row.email,
      orderNumber: row.order_number,
      orderMatched: row.order_id !== null,
      reason: row.reason,
      receivedAt: formatArgentinaDateTime(row.created_at),
    };

    const base = siteUrl();
    const links: EmailLinks = {
      logoUrl: base ? `${base}/brand/logo-horizontal-sin-frase-negro.png` : null,
      siteUrl: base,
      orderUrl: null,
      panelUrl: base ? `${base}/admin/arrepentimientos/${row.id}` : null,
      whatsappUrl: whatsappLink(settings, `Hola Home Deko, te escribo por mi solicitud de arrepentimiento ${row.code}.`),
    };
    const owners = ownersEmail(settings);

    const toCustomer = async () => {
      const result = await sendEmail({
        to: w.email,
        ...withdrawalReceivedEmail(w, links),
        replyTo: owners,
        idempotencyKey: `arrepentimiento-${row.id}-cliente`,
      });
      if (result.ok) await markSent(row.id, "customer_email_sent_at");
      else console.warn(`[email] no salió el mail de la solicitud ${row.code} al cliente`);
    };

    const toOwners = async () => {
      if (!owners) {
        console.warn(`[email] sin email del negocio en Configuración: no se avisó la solicitud ${row.code}.`);
        return;
      }
      const result = await sendEmail({
        to: owners,
        ...withdrawalOwnersEmail(w, links),
        replyTo: w.email,
        idempotencyKey: `arrepentimiento-${row.id}-duenos`,
      });
      if (result.ok) await markSent(row.id, "owners_email_sent_at");
      else console.warn(`[email] no salió el aviso de la solicitud ${row.code} a los dueños`);
    };

    await Promise.all([toCustomer(), toOwners()]);
  } catch (e) {
    console.error("[email] error con los mails de arrepentimiento", withdrawalId, e instanceof Error ? e.message : e);
  }
}

async function markSent(id: string, column: "customer_email_sent_at" | "owners_email_sent_at") {
  const now = new Date().toISOString();
  const values = column === "customer_email_sent_at" ? { customer_email_sent_at: now } : { owners_email_sent_at: now };
  const { error } = await createAdminClient().from("withdrawal_requests").update(values).eq("id", id);
  if (error) console.error("[email] no se pudo anotar el mail de la solicitud", error.message);
}
