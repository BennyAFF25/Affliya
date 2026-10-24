import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { renderNettmarkEmail } from "../utils/email/renderNettmarkEmail";

function read(file: string) {
  return fs.readFileSync(path.join(process.cwd(), file), "utf8");
}

function run() {
  const renderer = read("utils/email/renderNettmarkEmail.ts");
  assert.match(renderer, /#12CFE3/i);
  assert.match(renderer, /#11181C/i);
  assert.match(renderer, /border-radius:18px/);
  assert.doesNotMatch(renderer, /box-shadow:0 22px 60px/);
  assert.match(renderer, /border-top:1px solid/);
  assert.match(renderer, /secondaryCta/);
  assert.match(renderer, /NettmarkEmailNotice/);
  // iOS Gmail used to turn our dark emails pale. This is the opt-out for
  // Google-hosted mail accounts added in September 2026.
  const rendered = renderNettmarkEmail({
    heading: "Your Nettmark account is ready",
    body: "Start promoting with Nettmark.",
    badge: { text: "Business account", tone: "success" },
    cta: { label: "Create your first offer", href: "https://www.nettmark.com/onboarding/for-business" },
  });
  assert.match(rendered, /<meta name="color-scheme" content="light only" \/>/);
  assert.match(rendered, /<meta name="supported-color-schemes" content="light only" \/>/);
  assert.match(rendered, /bgcolor="#0B0F12"/);
  assert.match(rendered, /bgcolor="#11181C"/);
  assert.match(rendered, /color:#12CFE3/);
  assert.match(rendered, /background:#12CFE3/);
  assert.doesNotMatch(rendered, /#8CCFB4|#10B8C4|#17191A/);
  // Preserve the branded Gmail iOS dark experience without white inner gutters.
  assert.match(rendered, /class="nm-canvas-cell" align="center" bgcolor="#0B0F12"/);
  assert.match(rendered, /class="nm-canvas" role="presentation"/);
  assert.match(rendered, /background:#0B0F12;padding:0;/);
  assert.match(rendered, /@media only screen and \(max-width:620px\)/);
  assert.match(rendered, /td\.nm-card \{ border-radius:0 !important/);
  // Apple Mail and other supporting clients get a genuine light variant.
  assert.match(rendered, /:root \{ color-scheme: light dark; \}/);
  assert.match(rendered, /@media \(prefers-color-scheme: light\)/);
  assert.match(rendered, /background-color:#FFFFFF !important/);
  assert.match(rendered, /color:#121C24 !important/);



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
