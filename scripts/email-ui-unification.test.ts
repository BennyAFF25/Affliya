import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";

function read(file: string) {
  return fs.readFileSync(path.join(process.cwd(), file), "utf8");
}

function run() {
  const renderer = read("utils/email/renderNettmarkEmail.ts");
  assert.match(renderer, /#10B8C4/i);
  assert.match(renderer, /#101516/i);
  assert.match(renderer, /border-radius:18px/);
  assert.doesNotMatch(renderer, /box-shadow:0 22px 60px/);
  assert.match(renderer, /border-top:1px solid/);
  assert.match(renderer, /secondaryCta/);
  assert.match(renderer, /NettmarkEmailNotice/);

  const customerRoutes = [
    "app/api/emails/ad-decision/route.ts",
    "app/api/emails/affiliate-launch-invite/route.ts",
    "app/api/emails/affiliate-request-decision/route.ts",
    "app/api/emails/affiliate-request-sent/route.ts",
    "app/api/emails/affiliate-signup/route.ts",
    "app/api/emails/business-signup/route.ts",
    "app/api/emails/founder-notify/route.ts",
    "app/api/emails/new-offer/route.ts",
    "utils/email/sendInboxNotificationEmail.ts",
    "app/api/auth/send-password-reset/route.ts",
    "app/api/send-tracking-code/route.ts",
  ];

  for (const file of customerRoutes) {
    const source = read(file);
    assert.match(
      source,
      /renderNettmarkEmail/,
      `${file} must use the canonical Nettmark renderer`,
    );
  }

  const legacyTemplates = read("lib/email/templates.ts");
  assert.match(legacyTemplates, /renderNettmarkEmail/);
  assert.doesNotMatch(legacyTemplates, /first 150 users/i);
  assert.doesNotMatch(legacyTemplates, /free for life/i);

  const reset = read("app/api/auth/send-password-reset/route.ts");
  assert.match(reset, /Set a new password/);
  assert.match(reset, /resetUrl/);
  const tracking = read("app/api/send-tracking-code/route.ts");
  assert.doesNotMatch(tracking, /FalconX/);
  console.log("email UI unification tests passed");
}

run();
