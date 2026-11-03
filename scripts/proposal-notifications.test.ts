/* eslint-disable @typescript-eslint/no-explicit-any -- Node module mocks. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Module, { createRequire } from "node:module";
import { selectProposalReminderStage, PROPOSAL_REMINDER_START_AT } from "../utils/proposalReminders";
import { renderNettmarkEmail } from "../utils/email/renderNettmarkEmail";

const loader = Module as any;
const original = loader._load;
let sendMode = "ok", alerts = 0;
let options: { idempotencyKey?: string } | undefined;
loader._load = function(name: string, ...args: any[]) {
  if (name === "server-only") return {};
  if (name === "resend") return { Resend: class { emails = { send: async (_args: unknown, opts: typeof options) => {
    options = opts;
    if (sendMode === "throw") throw new Error("private provider details");
    return { error: sendMode === "error" ? { message: "private provider details" } : null };
  } }; } };
  if (name === "./sendFounderNotification") return { sendFounderNotification: async () => { alerts++; throw new Error("alert offline"); } };
  return original.call(this, name, ...args);
};
const { resolveProposalFromAddress, sendProposalEmail } = createRequire(__filename)("../utils/email/sendProposalEmail");
loader._load = original;
assert.equal(resolveProposalFromAddress({ NODE_ENV: "production" }), null);
assert.equal(resolveProposalFromAddress({ VERCEL_ENV: "production" }), null);
assert.equal(resolveProposalFromAddress({ NODE_ENV: "development" }), "Nettmark <onboarding@resend.dev>");
assert.equal(resolveProposalFromAddress({ RESEND_FROM_EMAIL: "hello@example.test", RESEND_FROM_NAME: "Brand" }), "Brand <hello@example.test>");
const createdAt = PROPOSAL_REMINDER_START_AT;
function stage(hours: number, sent: ("24h" | "72h")[] = [], overrides = {}) {
  return selectProposalReminderStage({ createdAt, now: new Date(Date.parse(createdAt) + hours * 3600000),
    status: "PeNdInG", alreadySent: new Set(sent), ...overrides });
}
assert.equal(stage(23), null);
assert.equal(stage(25), "24h");
assert.equal(stage(25, ["24h"]), null);
assert.equal(stage(73), "72h");
assert.equal(stage(73, ["24h"]), "72h");
assert.equal(stage(73, ["72h"]), null);
assert.equal(stage(25, [], { businessViewedAt: createdAt }), null);
assert.equal(stage(25, [], { status: "approved" }), null);
assert.equal(stage(25, [], { createdAt: "2026-11-03T08:29:59Z" }), null);
const page = readFileSync("app/affiliate/dashboard/promote/[offerId]/page.tsx", "utf8");
assert.ok(page.includes("/api/affiliate/organic-posts/notify-submitted"));
assert.doesNotMatch(page, /void fetch\([^;]*notify-submitted/);
const config = JSON.parse(readFileSync("vercel.json", "utf8"));
assert.ok(config.crons.some((cron: any) => cron.path === "/api/cron/proposal-reminders" && cron.schedule === "20 * * * *"));
for (const kind of ["organic-posts", "ad-ideas"]) {
  assert.ok(!readFileSync(`app/api/affiliate/${kind}/notify-submitted/route.ts`, "utf8").includes("onboarding@resend.dev"));
}
const html = renderNettmarkEmail({ heading: "Test", image: { src: 'https://example.test/"<', alt: '"<test>' }, rows: [{ label: "Caption", value: "<script>" }] });
assert.ok(html.includes('src="https://example.test/&quot;&lt;"'));
assert.ok(html.includes('alt="&quot;&lt;test&gt;"'));
assert.ok(html.includes("&lt;script&gt;"));
console.log("Proposal notification sender, reminder stages, image escaping and wiring passed");

async function checkSender() {
  const prior = { key: process.env.RESEND_API_KEY, from: process.env.RESEND_FROM_EMAIL, admin: process.env.ADMIN_NOTIFY_EMAIL };
  const priorError = console.error;
  const logs: unknown[][] = [];
  console.error = (...args: unknown[]) => { logs.push(args); };
  const events: any[] = [];
  const admin = { from: (table: string) => ({ insert: async (row: any) => {
    assert.equal(table, "product_events"); events.push(row); return { error: null };
  } }) };
  const args = { to: "brand@example.test", subject: "Proposal", html: "html", idempotencyKey: "proposal/test",
    proposalId: "test", kind: "organic", stage: "submitted" };
  try {
    process.env.RESEND_API_KEY = "test-secret";
    process.env.RESEND_FROM_EMAIL = "hello@example.test";
    process.env.ADMIN_NOTIFY_EMAIL = "founder@example.test";
    assert.deepEqual(await sendProposalEmail(admin, args), { ok: true });
    assert.equal(options?.idempotencyKey, args.idempotencyKey);
    assert.equal(events.length, 0);
    for (sendMode of ["error", "throw"]) assert.equal((await sendProposalEmail(admin, args)).ok, false);
    delete process.env.RESEND_API_KEY;
    assert.equal((await sendProposalEmail(admin, args)).ok, false);
    assert.equal(events.length, 3);
    assert.equal(alerts, 3);
    assert.ok(events.every(event => event.event_type === "proposal_email_failed" && event.actor_role === "system" && event.actor_email === args.to));
    assert.ok(!JSON.stringify(logs).includes("private provider details"));
    assert.ok(!JSON.stringify(logs).includes("test-secret"));
    console.log("Proposal sender success, provider errors, exceptions, failure audit and founder isolation passed");
  } finally {
    console.error = priorError;
    for (const [key, value] of Object.entries({ RESEND_API_KEY: prior.key, RESEND_FROM_EMAIL: prior.from, ADMIN_NOTIFY_EMAIL: prior.admin })) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
}
void checkSender();
