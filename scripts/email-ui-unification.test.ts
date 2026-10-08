import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";

function read(file: string) {
  return fs.readFileSync(path.join(process.cwd(), file), "utf8");
}

function run() {
  const renderer = read("utils/email/renderNettmarkEmail.ts");
  assert.match(renderer, /#00C2CB/i);
  assert.match(renderer, /#151718/i);
  assert.match(renderer, /border-radius:24px/);
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

  console.log("email UI unification tests passed");
}

run();
