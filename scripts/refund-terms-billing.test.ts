/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports -- Node test with module mocks. */
import assert from "node:assert/strict";
import Module from "node:module";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TERMS_VERSION, TERMS_PUBLISHED_LABEL, termsAcceptanceCurrent, termsProfileColumns, termsV2Enabled } from "../utils/legal/version";
import { growthTermsCopy, growthTermsEvidence, trialEndDate, REFUND_SUMMARY } from "../utils/legal/trialTerms";
import { checkoutTermsConsentParams, checkoutTosConsentEnabled } from "../utils/legal/checkoutConsent";
import { clientIpFromHeaders, findFreshCheckoutAcceptance } from "../utils/legal/acceptance";
import {
  allowedBillingNotificationKinds, billingNotificationEmail, billingNotificationIntents, billingNotificationsEnabled,
  formatStripeAmount, isTrialConversionInvoice, refundNotificationIntent, BILLING_NOTIFICATION_KINDS,
} from "../utils/billingNotifications";
import { selectGrowthTrialReminder, selectTrialBillingReminder, trialBillingReminderEmail } from "../utils/growthTrialLifecycle";
import { growthBillingPortalUrl, STRIPE_GROWTH_BILLING_LOGIN_URL } from "../utils/billingLinks";

async function main() {
const results: string[] = [];
const ok = (name: string) => results.push(name);

// ---- Flags default off ----
assert.equal(termsV2Enabled(undefined), false);
assert.equal(termsV2Enabled("true"), true);
assert.equal(checkoutTosConsentEnabled(undefined), false);
assert.equal(billingNotificationsEnabled(undefined), false);
ok("all new behaviour is flagged off by default");

// ---- Version checks ----
assert.equal(TERMS_VERSION, "terms-2026-12-v2");
assert.equal(termsAcceptanceCurrent({ terms_accepted: true }, false), true, "legacy check unchanged when flag off");
assert.equal(termsAcceptanceCurrent({ terms_accepted: true, terms_version: null }, true), false, "v2 asks again for older acceptances");
assert.equal(termsAcceptanceCurrent({ terms_accepted: true, terms_version: TERMS_VERSION }, true), true);
assert.equal(termsAcceptanceCurrent({ terms_accepted: false, terms_version: TERMS_VERSION }, true), false);
assert.equal(termsProfileColumns(false), "terms_accepted", "flag off never selects the new column (absent in prod)");
assert.equal(termsProfileColumns(true), "terms_accepted, terms_version");
ok("terms version gate: modal reappears after a TERMS_VERSION bump");

// ---- Trial summary ----
const now = new Date("2026-11-27T13:00:00Z"); // 27 Nov 23:30 Adelaide
assert.equal(trialEndDate(14, now), "11 December 2026", "today + 14 in Australia/Adelaide");
const trial = growthTermsCopy({ trialEligible: true, trialDays: 14, price: "A$49", period: "month", taxNotice: "Applicable tax is shown in checkout.", now });
assert.equal(trial.context, "trial_start");
assert.match(trial.bullets.join(" "), /14 days free, starting today, ending 11 December 2026\./);
assert.match(trial.bullets.join(" "), /Then A\$49\/month, charged automatically on 11 December 2026/);
assert.match(trial.bullets.join(" "), /We'll email you 7 days before your trial ends/);
assert.match(trial.bullets.join(" "), /non-refundable for change of mind, unused time or forgetting to cancel, except where the Australian Consumer Law requires/);
assert.match(trial.checkbox, /^I understand my trial becomes a paid A\$49\/month subscription on 11 December 2026 unless I cancel before then, and I agree to the Terms of Service, including the refund policy\.$/);
assert.equal(trial.button, "Start 14-day free trial (card required)");
const paid = growthTermsCopy({ trialEligible: false, trialDays: 14, price: "A$49", period: "month", now });
assert.equal(paid.context, "paid_start");
assert.match(paid.bullets[0], /A\$49\/month, charged today and every month until you cancel/);
assert.match(growthTermsEvidence(trial), /☑ I understand my trial/);
assert.match(REFUND_SUMMARY, /except where the Australian Consumer Law requires a refund/);
ok("trial and paid summaries show date, price and refund line");

// ---- Stripe Checkout consent params ----
const consent = checkoutTermsConsentParams({ trialEligible: true, trialDays: 14, price: { formatted: "A$49", interval: "month", intervalCount: 1 } });
assert.equal(consent.consent_collection.terms_of_service, "required");
assert.match(consent.custom_text.terms_of_service_acceptance.message, /\(https:\/\/www\.nettmark\.com\/legal\/privacy\/terms-of-service\)/);
assert.match(consent.custom_text.submit.message, /^Free for 14 days, then A\$49\/month charged automatically until you cancel\./);
for (const message of [consent.custom_text.terms_of_service_acceptance.message, consent.custom_text.submit.message]) assert.ok(message.length <= 1200);
assert.match(checkoutTermsConsentParams({ trialEligible: false, trialDays: 14, price: { formatted: "A$49", interval: "month", intervalCount: 1 } }).custom_text.submit.message, /charged today/);
ok("checkout consent_collection + custom_text built from the real price");

// ---- Checkout route contract ----
const checkout = readFileSync("app/api/business-subscription/create-checkout-session/route.ts", "utf8");
assert.match(checkout, /status: "terms_required"[\s\S]*status: 409/);
assert.ok(checkout.indexOf("findFreshCheckoutAcceptance") < checkout.indexOf("stripe.checkout.sessions.create"), "acceptance checked before a session is created");
assert.match(checkout, /checkoutTosConsentEnabled\(\)\s*\?\s*checkoutTermsConsentParams/);
assert.match(checkout, /terms_version: TERMS_VERSION, terms_acceptance_id: termsAcceptanceId/);
assert.match(checkout, /\$\{termsAcceptanceId \? `:\$\{TERMS_VERSION\}:\$\{termsAcceptanceId\}` : ""\}/, "idempotency key includes the terms version");
ok("checkout returns 409 without fresh acceptance and links metadata");

// ---- Fresh acceptance query ----
{
  const calls: Array<[string, unknown]> = [];
  const q: any = new Proxy({}, { get: (_t, prop: string) => prop === "maybeSingle" ? async () => ({ data: { id: "11111111-1111-4111-8111-111111111111" }, error: null }) : (...args: unknown[]) => { calls.push([prop, args]); return q; } });
  const id = await findFreshCheckoutAcceptance({ from: () => q } as any, { userId: "u", businessId: "b", context: "trial_start", now: Date.parse("2026-11-27T00:30:00Z") });
  assert.equal(id, "11111111-1111-4111-8111-111111111111");
  assert.deepEqual(calls.find(([name, args]) => name === "eq" && (args as string[])[0] === "version")?.[1], ["version", TERMS_VERSION]);
  assert.deepEqual(calls.find(([name]) => name === "gte")?.[1], ["accepted_at", "2026-11-27T00:00:00.000Z"], "30 minute window");
  assert.equal(clientIpFromHeaders(new Headers({ "x-forwarded-for": "203.0.113.9, 10.0.0.1" })), "203.0.113.9");
  assert.equal(clientIpFromHeaders(new Headers({ "x-forwarded-for": "not-an-ip" })), null);
  ok("acceptance lookup is version-, business- and 30-minute-scoped; IP is first hop");
}

// ---- Legal pages ----
{
  const { default: LegalPolicyContent } = await import("../app/components/legal/LegalPolicyContent");
  process.env.NEXT_PUBLIC_TERMS_V2_ENABLED = "true";
  const terms = renderToStaticMarkup(React.createElement(LegalPolicyContent, { policy: "terms" }));
  assert.match(terms, /7\. Subscriptions, Free Trials, Cancellation and Refunds/);
  assert.match(terms, /8\. Tracking &amp; Attribution/, "clauses after 7 renumbered");
  assert.equal((terms.match(/Nothing in these Terms excludes, restricts or modifies any right or remedy/g) || []).length, 2, "ACL carve-out on disclaimers and liability");
  assert.match(terms, /14\. Changes to These Terms[\s\S]*at least 30 days’ notice/);
  assert.doesNotMatch(terms, /Continued use of the\s+platform after changes constitutes acceptance/);
  assert.match(terms, /Nettmark Pty Ltd \(ABN 51 690 432 298\)/);
  assert.match(terms, new RegExp(`Last updated: ${TERMS_PUBLISHED_LABEL}`));
  for (const policy of ["privacy", "cookies"] as const) {
    assert.match(renderToStaticMarkup(React.createElement(LegalPolicyContent, { policy })), new RegExp(`Last updated: ${TERMS_PUBLISHED_LABEL}`));
  }
  assert.match(renderToStaticMarkup(React.createElement(LegalPolicyContent, { policy: "privacy" })), /your IP address and your browser’s user agent/);
  delete process.env.NEXT_PUBLIC_TERMS_V2_ENABLED;
  const legacy = renderToStaticMarkup(React.createElement(LegalPolicyContent, { policy: "terms" }));
  assert.doesNotMatch(legacy, /Subscriptions, Free Trials/);
  ok("legal pages: v2 clause 7, carve-outs, fixed dates; legacy unchanged with flag off");
}

// ---- Signup handler ----
{
  const serverOnlyLoader = Module as unknown as { _load: (...args: any[]) => any };
  const beforeServerOnly = serverOnlyLoader._load;
  serverOnlyLoader._load = function (name: string, ...args: any[]) { return name === "server-only" ? {} : beforeServerOnly.call(this, name, ...args); };
  const { createSignupHandler } = require("../utils/auth/signupHandler") as typeof import("../utils/auth/signupHandler");
  serverOnlyLoader._load = beforeServerOnly;
  const request = (body: Record<string, unknown>) => new Request("https://example.test/api/auth/signup", {
    method: "POST", headers: { origin: "https://example.test", "content-type": "application/json", "x-forwarded-for": "203.0.113.5", "user-agent": "QA-Agent/1.0" },
    body: JSON.stringify({ email: "brand@example.com", password: "Str0ng!Passw0rd", options: { data: { role: "business", username: "Brand" } }, ...body }),
  });
  const recorded: unknown[] = [];
  let identities: unknown[] = [{ id: "i" }];
  const handler = createSignupHandler({ limit: async () => true, termsV2: true, recordAcceptance: async (p) => { recorded.push(p); },
    client: () => ({ auth: { signUp: async () => ({ data: { user: { id: "user-1", identities }, session: null }, error: null }) } }) as any });
  const missing = await handler(request({}));
  assert.equal(missing.status, 400);
  assert.equal((await missing.json()).code, "terms_required");
  const stale = await handler(request({ termsAccepted: { version: "terms-old" } }));
  assert.equal(stale.status, 400);
  const accepted = await handler(request({ termsAccepted: { version: TERMS_VERSION } }));
  assert.equal(accepted.status, 200);
  assert.deepEqual(recorded, [{ userId: "user-1", ip: "203.0.113.5", userAgent: "QA-Agent/1.0" }] as unknown[]);
  identities = [];
  await handler(request({ termsAccepted: { version: TERMS_VERSION } }));
  assert.equal(recorded.length, 1, "existing email (no new identity) records nothing");
  const legacyHandler = createSignupHandler({ limit: async () => true, termsV2: false, recordAcceptance: async (p) => { recorded.push(p); },
    client: () => ({ auth: { signUp: async () => ({ data: { user: { id: "user-2", identities: [{}] } }, error: null }) } }) as any });
  assert.equal((await legacyHandler(request({}))).status, 200, "flag off: signup unchanged");
  assert.equal(recorded.length, 1);
  ok("signup enforces the checkbox server-side and records version, IP and user agent");
}

// ---- Webhook intents ----
const sub = (over: Record<string, unknown> = {}) => ({ id: "sub_1", status: "trialing", trial_start: 1764200000, trial_end: 1765409600, cancel_at_period_end: false, cancel_at: null, metadata: { nettmark_action: "business_subscription", business_id: "biz" }, items: { data: [{ current_period_end: 1765409600 }] }, ...over }) as any;
const ev = (type: string, object: Record<string, unknown>, previous?: Record<string, unknown>) => ({ id: "evt_" + type, type, created: 1764300000, data: { object, previous_attributes: previous } }) as any;
{
  const started = billingNotificationIntents(ev("checkout.session.completed", { id: "cs_1", mode: "subscription", consent: { terms_of_service: "accepted" } }), sub());
  assert.equal(started[0].kind, "trial_started");
  assert.equal(started[0].stripeObjectId, "sub_1");
  assert.equal(started[0].payload.consent_terms_of_service, "accepted");
  assert.deepEqual(billingNotificationIntents(ev("checkout.session.completed", { id: "cs_2", mode: "subscription" }), sub({ status: "active" })), []);

  const conversion = billingNotificationIntents(ev("invoice.paid", { id: "in_1", amount_paid: 4900, currency: "aud", billing_reason: "subscription_cycle", created: 1765409700 }), sub({ status: "active" }));
  assert.equal(conversion[0].kind, "trial_converted");
  const receipt = billingNotificationIntents(ev("invoice.paid", { id: "in_2", amount_paid: 4900, currency: "aud", billing_reason: "subscription_cycle", created: 1768000000 }), sub({ status: "active" }));
  assert.equal(receipt[0].kind, "payment_receipt");
  assert.deepEqual(billingNotificationIntents(ev("invoice.paid", { id: "in_3", amount_paid: 0, billing_reason: "subscription_create", created: 1764200000 }), sub()), [], "A$0 trial invoice sends nothing");
  assert.equal(isTrialConversionInvoice({ billing_reason: "subscription_create", created: 1765409700 } as any, { trial_end: 1765409600 } as any), false);

  const scheduled = billingNotificationIntents(ev("customer.subscription.updated", {}, { cancel_at_period_end: false, cancel_at: null }), sub({ cancel_at_period_end: true, cancel_at: 1765409600 }));
  assert.equal(scheduled.length, 1);
  assert.equal(scheduled[0].kind, "subscription_cancel_scheduled");
  assert.equal(scheduled[0].payload.trialing, true);
  assert.equal(scheduled[0].payload.access_until, 1765409600);
  assert.deepEqual(billingNotificationIntents(ev("customer.subscription.updated", {}, { metadata: {} }), sub({ cancel_at_period_end: true })), [], "unrelated update while scheduled sends nothing");
  assert.deepEqual(billingNotificationIntents(ev("customer.subscription.updated", {}, { cancel_at_period_end: true }), sub()), [], "resume sends nothing");
  assert.equal(billingNotificationIntents(ev("customer.subscription.updated", {}, { status: "past_due" }), sub({ status: "unpaid" }))[0].kind, "cancelled_nonpayment");

  assert.equal(billingNotificationIntents(ev("customer.subscription.deleted", {}), sub({ status: "canceled", cancellation_details: { reason: "payment_failed" } }))[0].kind, "cancelled_nonpayment");
  assert.equal(billingNotificationIntents(ev("customer.subscription.deleted", {}), sub({ status: "canceled", cancellation_details: { reason: "cancellation_requested" } }))[0].kind, "subscription_ended");
  assert.deepEqual(billingNotificationIntents(ev("invoice.payment_failed", {}), sub()), [], "failed payments stay with the recovery cron (E5)");

  const refund = refundNotificationIntent(ev("charge.refunded", { id: "ch_1", amount_refunded: 4900, currency: "aud" }, { amount_refunded: 0 }), "sub_1");
  assert.equal(refund?.stripeObjectId, "ch_1:4900");
  assert.equal(refund?.payload.refunded_delta, 4900);
  assert.equal(refundNotificationIntent(ev("charge.refunded", { id: "ch_1", amount_refunded: 4900 }, { amount_refunded: 4900 }), "sub_1"), null);
  ok("webhook events map to the right ledger kind, once per Stripe object");
}

// ---- Kinds allowlist ----
assert.equal(allowedBillingNotificationKinds(undefined).size, BILLING_NOTIFICATION_KINDS.length);
assert.deepEqual([...allowedBillingNotificationKinds("trial_started, subscription_cancel_scheduled,bogus")], ["trial_started", "subscription_cancel_scheduled"]);
assert.equal(allowedBillingNotificationKinds("none").size, 0);
ok("BILLING_NOTIFICATION_KINDS allowlist");

// ---- Copy ----
{
  const facts = { business: "Acme", amount: "A$49.00", last4: "4242", date: "27 November 2026", trialEnd: "11 December 2026", periodStart: "11 December 2026", periodEnd: "11 January 2027", invoiceUrl: "https://invoice.stripe.com/i/x", refundId: "re_1", trialing: true, portal: STRIPE_GROWTH_BILLING_LOGIN_URL, site: "https://www.nettmark.com" };
  const e1 = billingNotificationEmail("trial_started", facts);
  assert.equal(e1.subject, "Your Nettmark Growth trial has started — here are your terms");
  assert.match(JSON.stringify(e1.content), /charged automatically to your card ending 4242 on 11 December 2026/);
  assert.match(e1.content.footerNote || "", /Nettmark Pty Ltd · ABN 51 690 432 298 · Manage or cancel: https:\/\/billing\.stripe\.com/);
  assert.equal(billingNotificationEmail("trial_converted", facts).subject, "Payment received — Nettmark Growth A$49.00");
  assert.match(billingNotificationEmail("trial_converted", facts).content.body || "", /Your free trial ended on 27 November 2026/);
  assert.equal(billingNotificationEmail("cancelled_nonpayment", facts).content.cta?.href, "https://www.nettmark.com/business/choose-plan");
  assert.match(billingNotificationEmail("subscription_cancel_scheduled", facts).content.body || "", /trial has been cancelled and you won't be charged\. You'll keep Growth access until 11 December 2026/);
  assert.match(billingNotificationEmail("subscription_cancel_scheduled", { ...facts, trialing: false }).content.body || "", /until 11 January 2027, then your account moves to Free/);
  assert.equal(billingNotificationEmail("refund", facts).subject, "Refund processed — A$49.00");
  assert.equal(billingNotificationEmail("refund", facts).content.cta, undefined);
  assert.equal(formatStripeAmount(4900, "aud"), "A$49.00");
  const e3 = trialBillingReminderEmail("e3_2_day", { trialEnd: "11 December 2026", amount: "A$49.00", last4: "4242", portal: "https://billing.stripe.com/p/login/x" });
  assert.equal(e3.subject, "2 days left: your Growth trial ends on 11 December 2026");
  assert.match(e3.content.body || "", /A\$49\.00\/month will be charged to your card ending 4242/);
  assert.equal(trialBillingReminderEmail("e2_7_day", { trialEnd: "11 December 2026", amount: "A$49.00", last4: null, portal: "x" }).subject, "Your Growth trial ends on 11 December 2026 — A$49.00/month starts then");
  assert.equal(growthBillingPortalUrl({ STRIPE_BILLING_PORTAL_LOGIN_URL: "https://billing.stripe.com/p/login/test_abc" }), "https://billing.stripe.com/p/login/test_abc");
  assert.equal(growthBillingPortalUrl({ STRIPE_BILLING_PORTAL_LOGIN_URL: "https://evil.example/x" }), STRIPE_GROWTH_BILLING_LOGIN_URL);
  ok("email copy matches 04 §4 with ABN footer and portal link");
}

// ---- Trial reminder windows ----
assert.equal(selectGrowthTrialReminder(12.5, 1, { includeDay12: false }), null, "v2 moves day 12 to the trial-end path");
assert.equal(selectGrowthTrialReminder(12.5, 1)?.day, 12, "legacy day 12 unchanged when flag off");
assert.equal(selectGrowthTrialReminder(3.5, 1, { includeDay12: false })?.day, 3, "onboarding nudges untouched");
assert.equal(selectTrialBillingReminder(47, { e3: true, e2: false })?.eventType, "growth_trial_reminder_day_12");
assert.equal(selectTrialBillingReminder(0.5, { e3: true, e2: true }), null);
assert.equal(selectTrialBillingReminder(100, { e3: true, e2: false }), null, "no day-7 email unless NETTMARK_DAY7_TRIAL_REMINDER");
assert.equal(selectTrialBillingReminder(160, { e3: false, e2: true })?.eventType, "growth_trial_reminder_day_7");
assert.equal(selectTrialBillingReminder(60, { e3: true, e2: true }), null, "between windows");
ok("trial billing reminders are based on the trial end");

// ---- Enqueue (webhook) ----
type Row = Record<string, unknown>;
function fakeDb(entitlement: Row | null, opts: { failUpsert?: boolean } = {}) {
  const upserts: Array<{ rows: Row[]; options: Row }> = [];
  const db: any = {
    upserts,
    from(table: string) {
      const q: any = {
        select: () => q, limit: () => q, eq: () => q,
        maybeSingle: async () => ({ data: table === "business_entitlements" ? entitlement : null, error: null }),
        upsert: async (rows: Row[], options: Row) => { upserts.push({ rows, options }); return { error: opts.failUpsert ? { code: "XX" } : null }; },
      };
      return q;
    },
  };
  return db;
}
{
  const { enqueueBillingNotifications } = await import("../utils/billingNotificationsServer");
  const entitlement = { business_id: "biz", business_email: "brand@example.com", is_grandfathered: false, stripe_subscription_id: "sub_1" };
  const stripe: any = { invoicePayments: { list: async () => ({ data: [] }) }, invoices: { retrieve: async () => ({ parent: { subscription_details: { subscription: "sub_1" } } }) } };
  const event = ev("checkout.session.completed", { id: "cs_1", mode: "subscription" });

  delete process.env.BILLING_NOTIFICATIONS_ENABLED;
  let db = fakeDb(entitlement);
  assert.equal((await enqueueBillingNotifications({ admin: db, stripe, event, subscription: sub() })).enqueued, 0);
  assert.equal(db.upserts.length, 0, "flag off: nothing queued");

  process.env.BILLING_NOTIFICATIONS_ENABLED = "true";
  db = fakeDb(entitlement);
  assert.equal((await enqueueBillingNotifications({ admin: db, stripe, event, subscription: sub() })).enqueued, 1);
  assert.equal(db.upserts[0].rows[0].kind, "trial_started");
  assert.equal(db.upserts[0].rows[0].recipient_email, "brand@example.com");
  assert.deepEqual(db.upserts[0].options, { onConflict: "stripe_object_id,kind", ignoreDuplicates: true });

  db = fakeDb({ ...entitlement, is_grandfathered: true });
  assert.equal((await enqueueBillingNotifications({ admin: db, stripe, event, subscription: sub() })).enqueued, 0, "grandfathered skipped");

  process.env.BILLING_NOTIFICATION_KINDS = "refund";
  db = fakeDb(entitlement);
  assert.equal((await enqueueBillingNotifications({ admin: db, stripe, event, subscription: sub() })).enqueued, 0, "kind not in allowlist");
  delete process.env.BILLING_NOTIFICATION_KINDS;

  db = fakeDb(entitlement, { failUpsert: true });
  const failed = await enqueueBillingNotifications({ admin: db, stripe, event, subscription: sub() });
  assert.equal(failed.reason, "error", "ledger failure is swallowed so the webhook still returns 200");

  // Wallet top-up refund: charge has no subscription invoice.
  db = fakeDb(entitlement);
  const topUp = await enqueueBillingNotifications({ admin: db, stripe, event: ev("charge.refunded", { id: "ch_top", payment_intent: "pi_top", amount_refunded: 1000 }, { amount_refunded: 0 }) });
  assert.equal(topUp.enqueued, 0);
  assert.equal(topUp.reason, "not_a_business_subscription_charge");

  // Subscription charge refund via invoice payments (basil API has no charge.invoice).
  const subStripe: any = { invoicePayments: { list: async (params: any) => { assert.equal(params.payment.payment_intent, "pi_sub"); return { data: [{ invoice: "in_9" }] }; } }, invoices: { retrieve: async () => ({ parent: { subscription_details: { subscription: "sub_1" } } }) } };
  db = fakeDb(entitlement);
  const refunded = await enqueueBillingNotifications({ admin: db, stripe: subStripe, event: ev("charge.refunded", { id: "ch_sub", payment_intent: "pi_sub", amount_refunded: 4900, currency: "aud" }, { amount_refunded: 0 }) });
  assert.equal(refunded.enqueued, 1);
  assert.equal(db.upserts[0].rows[0].kind, "refund");

  // Non-business subscription (no metadata, not on an entitlement).
  db = fakeDb(null);
  assert.equal((await enqueueBillingNotifications({ admin: db, stripe, event, subscription: sub({ metadata: {} }) })).enqueued, 0);
  delete process.env.BILLING_NOTIFICATIONS_ENABLED;
  ok("webhook enqueue: flag, allowlist, grandfathered, top-ups and failure isolation");
}

// ---- Webhook wiring ----
{
  const webhook = readFileSync("app/api/business-subscription/webhook/route.ts", "utf8");
  assert.ok(webhook.indexOf("syncBusinessEntitlementFromStripeSubscription({") < webhook.indexOf("enqueueBillingNotifications({ admin: supabase, stripe, event, subscription })"));
  assert.match(webhook, /consent_terms_of_service: checkoutSession\.consent\?\.terms_of_service/);
  assert.doesNotMatch(webhook, /resend|Resend/, "webhook never sends email inline");
  const vercel = JSON.parse(readFileSync("vercel.json", "utf8"));
  assert.ok(vercel.crons.some((cron: Row) => cron.path === "/api/business-subscription/billing-notifications" && cron.schedule === "*/5 * * * *"));
  ok("webhook enqueues after entitlement sync; cron registered every 5 minutes");
}

// ---- Cron route ----
{
  const ledger: Row[] = [];
  const sends: Row[] = [];
  const updates: Row[] = [];
  const db: any = {
    from(table: string) {
      const filters: Array<(r: Row) => boolean> = [];
      let patch: Row | null = null;
      const q: any = {
        select: () => q, order: () => q, limit: () => q, lt: () => q, or: () => q, is: () => q,
        eq: (column: string, value: unknown) => { filters.push(r => r[column] === value); return q; },
        update: (values: Row) => { patch = values; return q; },
        maybeSingle: async () => {
          if (table === "business_profiles") return { data: { business_name: "Acme" }, error: null };
          const row = ledger.find(r => filters.every(f => f(r)));
          if (patch && row) { Object.assign(row, patch); updates.push({ id: row.id, ...patch }); }
          return { data: row || null, error: null };
        },
        then: (resolve: any, reject: any) => {
          if (patch) { for (const row of ledger.filter(r => filters.every(f => f(r)))) { Object.assign(row, patch); updates.push({ id: row.id, ...patch }); } return Promise.resolve({ error: null }).then(resolve, reject); }
          return Promise.resolve({ data: ledger.filter(r => ["pending", "failed"].includes(String(r.status))), error: null }).then(resolve, reject);
        },
      };
      return q;
    },
  };
  const stripe: any = {
    subscriptions: { retrieve: async () => ({ id: "sub_1", status: "trialing", trial_start: 1764200000, trial_end: 1765409600, cancel_at_period_end: false, cancel_at: null, default_payment_method: { card: { last4: "4242" } }, items: { data: [{ quantity: 1, price: { unit_amount: 4900, currency: "aud" } }] } }) },
  };
  const loader = Module as unknown as { _load: (...args: any[]) => any };
  const original = loader._load;
  loader._load = function (name: string, ...args: any[]) {
    if (name.endsWith("/utils/businessSubscriptions")) return { createServerSupabaseClient: () => db, createBusinessSubscriptionStripeClient: () => stripe };
    if (name === "resend") return { Resend: class { emails = { send: async (message: Row, options: Row) => { sends.push({ ...message, ...options }); return { data: { id: "em_1" }, error: null }; } }; } };
    return original.call(this, name, ...args);
  };
  try {
    process.env.CRON_SECRET = "cron-test";
    process.env.RESEND_API_KEY = "re_test";
    process.env.RESEND_FROM_EMAIL = "no-reply@example.test";
    process.env.VERCEL_ENV = "preview";
    const { GET } = require("../app/api/business-subscription/billing-notifications/route");
    const call = async (auth = "Bearer cron-test") => GET(new Request("https://example.test/cron", { headers: { authorization: auth } }));
    assert.equal((await call("Bearer wrong")).status, 401);
    delete process.env.BILLING_NOTIFICATIONS_ENABLED;
    assert.equal((await (await call()).json()).disabled, true, "cron does nothing while flag is off");
    process.env.BILLING_NOTIFICATIONS_ENABLED = "true";
    const created = new Date().toISOString();
    ledger.push(
      { id: "r1", business_id: "biz", kind: "trial_started", stripe_object_id: "sub_1", stripe_subscription_id: "sub_1", recipient_email: "nettmarkqa+trial@mail.grokbot.com", payload: {}, status: "pending", attempt_count: 0, claimed_at: null, created_at: created },
      { id: "r2", business_id: "biz", kind: "trial_started", stripe_object_id: "sub_2", stripe_subscription_id: "sub_2", recipient_email: "real.customer@gmail.com", payload: {}, status: "pending", attempt_count: 0, claimed_at: null, created_at: created },
    );
    const result = await (await call()).json();
    assert.deepEqual({ sent: result.sent, failed: result.failed }, { sent: 1, failed: 0 });
    assert.equal(sends.length, 1);
    assert.equal(sends[0].idempotencyKey, "billing/trial_started/sub_1");
    assert.equal(sends[0].replyTo, "contact@nettmark.com");
    assert.match(String(sends[0].html), /card ending 4242/);
    assert.equal(ledger[0].status, "sent");
    assert.equal(ledger[1].status, "skipped", "non-QA recipients are never emailed outside production");
    await call();
    assert.equal(sends.length, 1, "a sent row is never sent again");
  } finally {
    loader._load = original;
    delete process.env.BILLING_NOTIFICATIONS_ENABLED;
    delete process.env.VERCEL_ENV;
  }
  ok("cron: auth, flag, QA-only recipients outside production, idempotency key, sent once");
}

// ---- Trial reminders route: E3 for any cohort, rechecked against Stripe ----
{
  const events: Row[] = [];
  const sends: Row[] = [];
  const trialEndMs = Date.now() + 40 * 3600000;
  let subscription: Row = { id: "sub_1", status: "trialing", cancel_at_period_end: false, cancel_at: null, trial_end: Math.floor(trialEndMs / 1000), default_payment_method: { card: { last4: "1111" } }, items: { data: [{ quantity: 1, price: { unit_amount: 4900, currency: "aud" } }] } };
  const db: any = {
    auth: { admin: { getUserById: async () => ({ data: { user: { user_metadata: {} } } }) } },
    from(table: string) {
      const filters: Array<(r: Row) => boolean> = [];
      const result = () => table === "business_entitlements"
        ? { data: [{ business_id: "biz", business_email: "nettmarkqa+old@mail.grokbot.com", growth_trial_started_at: null, subscription_current_period_end: new Date(trialEndMs).toISOString(), stripe_subscription_id: "sub_1" }], error: null }
        : table === "offers" ? { count: 1, error: null } : { data: events.find(e => filters.every(f => f(e))) || null, error: null };
      const q: any = {
        select: () => q, gte: () => q, order: () => q, limit: () => q, ilike: () => q,
        or: (filter: string) => { assert.match(filter, /subscription_current_period_end\.gt\./); return q; },
        eq: (column: string, value: unknown) => { filters.push(e => e[column] === value); return q; },
        in: (column: string, values: unknown[]) => { filters.push(e => values.includes(e[column])); return q; },
        maybeSingle: async () => result(),
        then: (resolve: any, reject: any) => Promise.resolve(result()).then(resolve, reject),
        insert: async (event: Row) => { events.push(event); return { error: null }; },
      };
      return q;
    },
  };
  const stripe: any = { subscriptions: { retrieve: async () => subscription } };
  const loader = Module as unknown as { _load: (...args: any[]) => any };
  const original = loader._load;
  loader._load = function (name: string, ...args: any[]) {
    if (name.endsWith("/utils/businessSubscriptions")) return { createServerSupabaseClient: () => db, createBusinessSubscriptionStripeClient: () => stripe };
    if (name === "resend") return { Resend: class { emails = { send: async (message: Row, options: Row) => { sends.push({ ...message, ...options }); return { error: null }; } }; } };
    return original.call(this, name, ...args);
  };
  try {
    process.env.CRON_SECRET = "cron-test";
    process.env.TRIAL_BILLING_REMINDERS_V2_ENABLED = "true";
    delete process.env.ADMIN_NOTIFY_EMAIL;
    const { GET } = require("../app/api/business-subscription/trial-reminders/route");
    const call = () => GET(new Request("https://example.test/cron", { headers: { authorization: "Bearer cron-test" } }));
    await call();
    assert.equal(sends.length, 1, "E3 reaches a business outside the plan_first_v2 cohort");
    assert.equal(sends[0].idempotencyKey, "growth-trial-12/biz");
    assert.match(String(sends[0].subject), /^2 days left: your Growth trial ends on /);
    assert.match(String(sends[0].html), /card ending 1111/);
    await call();
    assert.equal(sends.length, 1, "sent once");
    events.length = 0; sends.length = 0;
    subscription = { ...subscription, cancel_at_period_end: true };
    await call();
    assert.equal(sends.length, 0, "cancelled trial gets no 'you will be charged' reminder");
  } finally {
    loader._load = original;
    delete process.env.TRIAL_BILLING_REMINDERS_V2_ENABLED;
  }
  ok("trial reminders v2: E3 for every cohort, once, skipped when cancelled");
}

console.log(`refund policy / terms acceptance / billing emails: ${results.length} groups passed`);
for (const name of results) console.log(`  ok - ${name}`);
}
void main().catch((error) => { console.error(error); process.exitCode = 1; });
