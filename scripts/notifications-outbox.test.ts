import assert from "node:assert/strict";
import { buildNotificationEmail } from "../utils/email/notificationTemplates";
import { enqueueNotification, type NotificationKind } from "../utils/email/notificationOutbox";

const types: NotificationKind[] = [
  "subscription_payment_failed", "subscription_action_required",
  "subscription_payment_recovered", "subscription_receipt",
  "subscription_trial_converted", "subscription_cancel_scheduled", "subscription_cancelled",
  "wallet_funded", "wallet_payment_failed", "wallet_review",
  "wallet_refund_succeeded", "wallet_refund_failed", "wallet_low_balance",
  "campaign_auto_paused", "campaign_auto_paused_business", "campaign_launch_failed",
  "campaign_resumed", "campaign_earnings_available", "payout_transferred",
  "payout_failed", "partner_message", "subscription_reminder_48h",
  "subscription_reminder_5d",
];

async function main() {
  for (const type of types) {
    const email = buildNotificationEmail(type, {
      amount_cents: 4900, currency: "aud", recipient_role: "affiliate",
    });
    assert.ok(email.subject && email.subject.length > 8, type);
    assert.ok(email.html.includes("Nettmark"), type);
    assert.ok(email.html.includes("https://www.nettmark.com/"), type);
    assert.ok(!email.html.includes("stripe.com/checkout"), type);
  }
  const escaped = buildNotificationEmail("subscription_payment_failed",
    { amount_cents: 4900, currency: "<script>" });
  assert.ok(!escaped.html.includes("<script>"));

  const existingFlag = process.env.NETTMARK_NOTIFICATION_ENQUEUE_ENABLED;
  process.env.NETTMARK_NOTIFICATION_ENQUEUE_ENABLED = "false";
  let inserts = 0;
  const db = {
    from(table: string) {
      assert.equal(table, "notification_outbox");
      return { upsert(input: Record<string, unknown>) {
        inserts++;
        assert.equal(input.recipient, "valid@example.com");
        assert.equal(input.event_key, "test");
        assert.equal(input.account_scope, "subscription");
        return Promise.resolve({ error: null });
      } };
    }
  };
  const input = {
    key: "test", kind: "subscription_receipt" as const, scope: "subscription" as const,
    recipient: "VALID@example.com", payload: { amount_cents: 4900 },
  };
  assert.equal(await enqueueNotification(db as never, input), false);
  assert.equal(inserts, 0, "Off by default");
  process.env.NETTMARK_NOTIFICATION_ENQUEUE_ENABLED = "true";
  assert.equal(await enqueueNotification(db as never, { ...input, recipient: "bad-email" }), false);
  assert.equal(inserts, 0, "Reject invalid recipient");
  assert.equal(await enqueueNotification(db as never, input), true);
  assert.equal(inserts, 1);
  if (existingFlag === undefined) delete process.env.NETTMARK_NOTIFICATION_ENQUEUE_ENABLED;
  else process.env.NETTMARK_NOTIFICATION_ENQUEUE_ENABLED = existingFlag;
  console.log("Notifications tests passed for " + types.length + " templates and enqueue controls.");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
