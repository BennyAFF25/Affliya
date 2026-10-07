import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  AFFILIATE_ASSISTANT_EMAIL,
  affiliateWebhookRetryDelayMs,
  affiliateWebhookScopeDecision,
  createAffiliateWebhookTestPayload,
} from "../utils/affiliateAssistantWebhook";

function run() {
  assert.equal(AFFILIATE_ASSISTANT_EMAIL, "jamesmarkets@gmail.com");

  assert.equal(affiliateWebhookRetryDelayMs(1), 60_000);
  assert.equal(affiliateWebhookRetryDelayMs(2), 5 * 60_000);
  assert.equal(affiliateWebhookRetryDelayMs(3), 30 * 60_000);
  assert.equal(affiliateWebhookRetryDelayMs(4), 2 * 60 * 60_000);
  assert.equal(affiliateWebhookRetryDelayMs(5), 12 * 60 * 60_000);
  assert.equal(affiliateWebhookRetryDelayMs(6), null);

  assert.equal(
    affiliateWebhookScopeDecision("brand.signed_up", null),
    "deliver",
  );
  assert.equal(
    affiliateWebhookScopeDecision(
      "proposal.approved",
      "JAMESMARKETS@gmail.com",
    ),
    "deliver",
  );
  assert.equal(
    affiliateWebhookScopeDecision(
      "proposal.rejected",
      "other@example.com",
    ),
    "skip",
  );
  assert.equal(
    affiliateWebhookScopeDecision(
      "message.received",
      "jamesmarkets@gmail.com",
    ),
    "deliver",
  );

  const payload = createAffiliateWebhookTestPayload();
  assert.equal(payload.type, "brand.signed_up");
  assert.equal(payload.brand.name, "Webhook Test");
  assert.match(payload.occurred_at, /\+00:00$/);
  assert.ok(payload.event_id.startsWith("evt_test_"));

  const helper = fs.readFileSync(
    path.join(process.cwd(), "utils/affiliateAssistantWebhook.ts"),
    "utf8",
  );

  assert.match(helper, /AFFILIATE_WEBHOOK_AUTH/);
  assert.doesNotMatch(helper, /AFFILIATE_WEBHOOK_KEY/);
  assert.match(helper, /Authorization: authorization/);
  assert.match(helper, /"Content-Type": "application\/json"/);
  assert.match(helper, /setTimeout\(\(\) => controller\.abort\(\), 10_000\)/);
  assert.match(helper, /attempt <= 2/);

  const migration = fs.readFileSync(
    path.join(
      process.cwd(),
      "supabase/migrations/20261007080000_affiliate_assistant_webhook_outbox.sql",
    ),
    "utf8",
  );

  assert.match(migration, /affiliate_webhook_outbox/);
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /for update skip locked/i);
  assert.match(
    migration,
    /revoke execute[\s\S]+from public, anon, authenticated/i,
  );
  assert.match(
    migration,
    /jamesmarkets@gmail\.com/i,
  );
  assert.doesNotMatch(
    migration,
    /jsonb_build_object\([\s\S]{0,300}'access_token'/i,
  );

  const worker = fs.readFileSync(
    path.join(
      process.cwd(),
      "app/api/affiliate-assistant/webhook-delivery/route.ts",
    ),
    "utf8",
  );

  assert.match(worker, /CRON_SECRET/);
  assert.match(worker, /deliverPendingAffiliateWebhookEvents/);

  const adminRoute = fs.readFileSync(
    path.join(
      process.cwd(),
      "app/api/admin/test-affiliate-webhook/route.ts",
    ),
    "utf8",
  );

  assert.match(adminRoute, /CRON_SECRET/);
  assert.match(adminRoute, /WebhookTestPayload/);
  assert.match(adminRoute, /webhook_status/);

  console.log("affiliate assistant webhook tests passed");
}

run();
