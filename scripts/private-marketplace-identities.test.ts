import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";

function read(file: string) {
  return fs.readFileSync(path.join(process.cwd(), file), "utf8");
}

function run() {
  const createAccount = read("app/create-account/page.tsx");
  assert.match(createAccount, /Shown to businesses instead of your email address/);
  assert.match(createAccount, /username: trimmedUsername/);
  assert.match(createAccount, /Username must be 3–24 characters/);

  const requests = read("app/business/my-business/affiliate-requests/page.tsx");
  assert.match(requests, /affiliateNames/);
  assert.doesNotMatch(requests, />\s*\{req\.affiliate_email\}\s*</);

  const adIdeas = read("app/business/my-business/ad-ideas/page.tsx");
  assert.match(adIdeas, /affiliateNames/);
  assert.doesNotMatch(adIdeas, /From: \{idea\.affiliate_email\}/);

  const postIdeas = read("app/business/my-business/post-ideas/page.tsx");
  assert.match(postIdeas, /usernameMap/);
  assert.doesNotMatch(postIdeas, />\s*\{post\.affiliate_email\}\s*</);
  assert.doesNotMatch(postIdeas, />\s*\{selectedPost\.affiliate_email\}\s*</);

  const inbox = read("app/components/inbox/DbBackedInbox.tsx");
  assert.doesNotMatch(inbox, /row\.sender_name \|\| row\.sender_email/);

  const inboxRoute = read("app/api/inbox-messages/route.ts");
  assert.match(inboxRoute, /resolvedSenderName/);
  assert.doesNotMatch(inboxRoute, /sender_name: body\.sender_name/);

  const templates = read("lib/email/templates.ts");
  assert.match(templates, /affiliateName \|\| "Nettmark affiliate"/);
  assert.doesNotMatch(templates, /label: "Affiliate", value: params\.affiliateEmail/);

  const migration = read(
    "supabase/migrations/20261008073500_private_marketplace_identities.sql",
  );
  assert.match(migration, /profiles_affiliate_username_lower_unique/);
  assert.match(migration, /display_name = p\.username/);

  console.log("private marketplace identity tests passed");
}

run();
