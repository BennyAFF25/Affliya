import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { createBusinessSubscriptionStripeClient } from "../../../../utils/businessSubscriptions";
import { buildNotificationEmail } from "../../../../utils/email/notificationTemplates";
import type { NotificationKind } from "../../../../utils/email/notificationOutbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type NotificationRow = {
  id: string; event_type: NotificationKind; account_scope: string; recipient: string;
  payload: Record<string, unknown>; attempt_count: number;
};
const permitted = (req: Request) => {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && req.headers.get("authorization") === "Bearer " + secret);
};
function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secret) throw new Error("Supabase service role is unavailable");
  return createClient(url, secret, { auth: { persistSession: false } });
}
async function preflight(db: SupabaseClient, row: NotificationRow) {
  if (row.event_type === "partner_message") {
    const messageId = row.payload.message_id;
    if (typeof messageId !== "string") return false;
    const { data, error } = await db.from("inbox_chat_messages")
      .select("id,read_at").eq("id", messageId).maybeSingle();
    if (error) throw error;
    return Boolean(data && !data.read_at);
  }
  if (row.account_scope === "subscription") {
    const invoiceId = row.payload.invoice_id;
    const subscriptionId = row.payload.subscription_id;
    const failedTypes: NotificationKind[] = [
      "subscription_payment_failed", "subscription_action_required",
      "subscription_reminder_48h", "subscription_reminder_5d"
    ];
    if (failedTypes.includes(row.event_type)) {
      if (typeof invoiceId !== "string") return false;
      const invoice = await createBusinessSubscriptionStripeClient().invoices.retrieve(invoiceId);
      return invoice.status === "open" && invoice.amount_remaining > 0;
    }
    if (["subscription_receipt", "subscription_payment_recovered", "subscription_trial_converted"].includes(row.event_type)) {
      if (typeof invoiceId !== "string") return false;
      const invoice = await createBusinessSubscriptionStripeClient().invoices.retrieve(invoiceId);
      return invoice.status === "paid" && invoice.amount_paid > 0;
    }
    if (row.event_type === "subscription_cancel_scheduled") {
      if (typeof subscriptionId !== "string") return false;
      const sub = await createBusinessSubscriptionStripeClient().subscriptions.retrieve(subscriptionId);
      return sub.cancel_at_period_end === true && sub.status !== "canceled";
    }
    if (row.event_type === "subscription_cancelled") {
      if (typeof subscriptionId !== "string") return false;
      const sub = await createBusinessSubscriptionStripeClient().subscriptions.retrieve(subscriptionId);
      return sub.status === "canceled";
    }
  }
  if (row.event_type === "payout_transferred") {
    const id = row.payload.payout_id;
    if (typeof id !== "string") return false;
    const { data, error } = await db.from("wallet_payouts")
      .select("status,stripe_transfer_id").eq("id", id).maybeSingle();
    if (error) throw error;
    return data?.status === "completed" && Boolean(data.stripe_transfer_id);
  }
  if (row.event_type === "wallet_funded") {
    const session = row.payload.checkout_session_id;
    if (typeof session !== "string") return false;
    const { data, error } = await db.from("wallet_topups")
      .select("status").eq("stripe_id", session).maybeSingle();
    if (error) throw error;
    return data?.status === "succeeded";
  }
  if (row.event_type === "wallet_refund_succeeded" || row.event_type === "wallet_refund_failed") {
    const id = row.payload.attempt_id;
    if (typeof id !== "string") return false;
    const { data, error } = await db.from("wallet_refund_attempts")
      .select("status").eq("id", id).maybeSingle();
    if (error) throw error;
    return data?.status === (row.event_type === "wallet_refund_succeeded" ? "succeeded" : "failed");
  }
  return true;
}
async function mark(db: SupabaseClient, id: string, values: Record<string, unknown>) {
  const { error } = await db.from("notification_outbox")
    .update({ ...values, updated_at: new Date().toISOString() })
    .eq("id", id).eq("status", "processing");
  if (error) throw error;
}
async function handle(req: Request) {
  if (!permitted(req)) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (process.env.NETTMARK_NOTIFICATION_SEND_ENABLED !== "true")
    return NextResponse.json({ enabled: false, sent: 0 }, { headers: { "Cache-Control": "no-store" } });
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL)
    return NextResponse.json({ error: "Resend not configured" }, { status: 503 });

  const db = admin();
  const { data, error } = await db.rpc("notification_claim_batch", { batch_size: 15 });
  if (error) return NextResponse.json({ error: "Outbox claim failed" }, { status: 503 });
  const resend = new Resend(process.env.RESEND_API_KEY);
  const from = (process.env.RESEND_FROM_NAME || "Nettmark") + " <" + process.env.RESEND_FROM_EMAIL + ">";
  const stats = { sent: 0, cancelled: 0, retry: 0, dead: 0 };
  for (const row of (data || []) as NotificationRow[]) {
    try {
      const eligible = await preflight(db, row);
      if (!eligible) {
        await mark(db, row.id, { status: "cancelled", last_error: "State no longer requires notification" });
        stats.cancelled++;
        continue;
      }
      const email = buildNotificationEmail(row.event_type, row.payload || {});
      const result = await resend.emails.send({
        from, to: [row.recipient], subject: email.subject, html: email.html
      }, { idempotencyKey: "nettmark-outbox/" + row.id });
      if (result.error || !result.data?.id) throw new Error(result.error?.message || "Resend rejected email");
      await mark(db, row.id, {
        status: "sent", sent_at: new Date().toISOString(),
        provider_message_id: result.data.id, last_error: null
      });
      stats.sent++;
    } catch (e) {
      const attempt = Number(row.attempt_count || 1);
      const exhausted = attempt >= 6;
      const delayMins = Math.min(360, 5 * Math.pow(2, Math.max(0, attempt - 1)));
      try {
        await mark(db, row.id, {
          status: exhausted ? "dead" : "queued",
          available_at: new Date(Date.now() + delayMins * 60000).toISOString(),
          last_error: e instanceof Error ? e.message.slice(0, 400) : "Unknown dispatch error"
        });
      } catch (saveError) {
        console.error("[notification-dispatch] failed to update row", row.id, saveError instanceof Error ? saveError.message : "unknown");
      }
      if (exhausted) stats.dead++; else stats.retry++;
    }
  }
  return NextResponse.json({ enabled: true, ...stats }, { headers: { "Cache-Control": "no-store" } });
}
export async function GET(req: Request) { return handle(req); }
