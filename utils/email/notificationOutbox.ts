import type { SupabaseClient } from "@supabase/supabase-js";

export type NotificationScope = "subscription" | "platform" | "product";
export type NotificationKind =
  | "subscription_payment_failed" | "subscription_action_required"
  | "subscription_payment_recovered" | "subscription_receipt"
  | "subscription_trial_converted" | "subscription_cancel_scheduled" | "subscription_cancelled"
  | "wallet_funded" | "wallet_payment_failed" | "wallet_review"
  | "wallet_refund_succeeded" | "wallet_refund_failed"
  | "wallet_low_balance" | "campaign_auto_paused" | "campaign_launch_failed"
  | "campaign_resumed" | "campaign_earnings_available"
  | "payout_transferred" | "payout_failed" | "partner_message"
  | "subscription_reminder_48h" | "subscription_reminder_5d";

export type NotificationInput = {
  key: string;
  kind: NotificationKind;
  scope: NotificationScope;
  recipient: string;
  payload?: Record<string, unknown>;
  delayMinutes?: number;
};

/**
 * Only a service-role caller may enqueue. This helper is intentionally best-effort:
 * email failure must never roll back money movement, webhook acknowledgements or messaging.
 * The enqueue flag prevents retroactive customer emails on first activation.
 */
export async function enqueueNotification(supabase: SupabaseClient, input: NotificationInput) {
  if (process.env.NETTMARK_NOTIFICATION_ENQUEUE_ENABLED !== "true") return false;
  const email = input.recipient.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return false;
  if (!input.key || input.key.length > 250) return false;
  const { error } = await supabase.from("notification_outbox").upsert({
    event_key: input.key, event_type: input.kind, account_scope: input.scope,
    recipient: email, payload: input.payload || {},
    available_at: new Date(Date.now() + Math.max(0, input.delayMinutes || 0) * 60000).toISOString(),
  }, { onConflict: "event_key,recipient", ignoreDuplicates: true });
  if (error) {
    console.warn("[notifications] enqueue failed", { kind: input.kind, code: error.code });
    return false;
  }
  return true;
}

export async function enqueueSafely(supabase: SupabaseClient, input: NotificationInput) {
  try { await enqueueNotification(supabase, input); }
  catch (error) {
    console.warn("[notifications] enqueue exception", input.kind, error instanceof Error ? error.message : "unknown");
  }
}
