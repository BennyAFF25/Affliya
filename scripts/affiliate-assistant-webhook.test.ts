import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  affiliateWebhookRetryDelayMs,
  affiliateWebhookScopeDecision,
} from "../utils/affiliateAssistantWebhook";

function run() {
  assert.equal(affiliateWebhookRetryDelayMs(1), 60_000);
  assert.equal(affiliateWebhookRetryDelayMs(2), 5 * 60_000);
  assert.equal(affiliateWebhookRetryDelayMs(3), 30 * 60_000);
  assert.equal(affiliateWebhookRetryDelayMs(4), 2 * 60 * 60_000);
  assert.equal(affiliateWebhookRetryDelayMs(5), 12 * 60 * 60_000);
  assert.equal(affiliateWebhookRetryDelayMs(6), null);

  assert.equal(
    affiliateWebhookScopeDecision("brand.signed_up", null, "bot@example.com"),
    "deliver",
  );
  assert.equal(
    affiliateWebhookScopeDecision(
      "proposal.approved",
      "bot@example.com",
      "BOT@example.com",
    ),
    "deliver",
  );
  assert.equal(
    affiliateWebhookScopeDecision(
      "proposal.rejected",
      "other@example.com",
      "bot@example.com",
    ),
    "skip",
  );
  assert.equal(
    affiliateWebhookScopeDecision(
      "message.received",
      "bot@example.com",
      "",
    ),
    "missing_assistant",
  );

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

  console.log("affiliate assistant webhook tests passed");
}

run();
