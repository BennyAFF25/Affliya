import * as assert from "node:assert/strict";
import Module from "node:module";
import { affiliateOnboardingPath, roleReturnTo, visibleOnboardingOffer, rankOnboardingOffers, onboardingCommission, canUsePreapprovedOrganic, type OnboardingOffer } from "../utils/affiliate/onboarding";
import { buildPromotionContext, eligibleCreative, validatePromotionPack } from "../utils/affiliate/promotionPack";
import { getPromotionAIConfig, generatePromotionPack, reservePromotionQuota, PromotionAIError } from "../lib/affiliate/promotionAI";

const offerId = "11111111-1111-4111-8111-111111111111";
const creativeId = "22222222-2222-4222-8222-222222222222";
const userId = "33333333-3333-4333-8333-333333333333";
const otherId = "44444444-4444-4444-8444-444444444444";
const pack = {
  campaignAngle: "Explore the offer", hooks: ["Discover the details", "Find your next option", "Meet the brand"],
  primaryAdCopy: "Explore the offer and its features.", headline: "Explore the brand", cta: "LEARN_MORE",
  organicCaption: "Explore this brand. Affiliate link: [your tracking link]", explanation: "The angle uses the saved offer description.",
};
const offer = { id: offerId, title: "Test offer", description: "A reusable water bottle.", business_email: "brand@example.test", status: "active", participation_mode: "open", website: "https://example.test", access_token: "exclude-secret", commission: 30 };
const asset = { id: creativeId, business_email: offer.business_email, offer_id: offerId, caption: "Reusable bottle", allow_organic: true, allow_paid: true, organic_preapproved: true, is_active: true, archived_at: null, media_url: "https://example.test/bottle.jpg" };

async function main() {
  assert.equal(affiliateOnboardingPath(offerId, "ad"), "/onboarding/for-partners?offerId=" + offerId + "&mode=ad");
  assert.equal(affiliateOnboardingPath("injected,id", "bad"), "/onboarding/for-partners");
  assert.equal(roleReturnTo("/onboarding/for-partners?offerId=" + offerId, "affiliate"), "/onboarding/for-partners?offerId=" + offerId);
  assert.equal(roleReturnTo("/business/dashboard", "affiliate"), null);
  for (const path of ["//evil.test", "/affiliate/../business/dashboard", "/affiliate/%2e%2e/business", "/affiliate/%2f%2fevil", "/affiliate/\\evil", "/affiliate/\npath"]) {
    assert.equal(roleReturnTo(path, "affiliate"), null, path);
  }
  assert.equal(visibleOnboardingOffer(offer, null), true);
  assert.equal(visibleOnboardingOffer({ ...offer, participation_mode: "private" }, null), false);
  assert.equal(visibleOnboardingOffer({ ...offer, participation_mode: "private" }, "approved"), true);
  assert.equal(visibleOnboardingOffer(offer, "rejected"), false);
  assert.equal(visibleOnboardingOffer({ ...offer, status: "draft" }, "approved"), false);
  assert.equal(visibleOnboardingOffer({ ...offer, participation_mode: "unknown" }, null), false);
  const dto: OnboardingOffer = { id: offerId, title: "Offer", description: "", logoUrl: null, commission: 30, commissionValue: null, currency: "USD", type: "one-time", participationMode: "open", requestStatus: null, readyOrganicCount: 0 };
  assert.deepEqual(rankOnboardingOffers([
    { ...dto, id: "pending", requestStatus: "pending", participationMode: "approval_required" },
    { ...dto, id: "request", participationMode: "approval_required", readyOrganicCount: 10 },
    { ...dto, id: "ready", readyOrganicCount: 1 },
    { ...dto, id: "approved", requestStatus: "approved" },
  ]).map(row => row.id), ["approved", "ready", "request", "pending"]);

  const summary = (overrides: Partial<OnboardingOffer>) => {
    const result = onboardingCommission({ ...dto, ...overrides });
    return { label: result.label.replace(/\u00a0/g, " "), detail: result.detail?.replace(/\u00a0/g, " ") ?? null };
  };
  assert.deepEqual(summary({ price: 49.99, commissionValue: 15, currency: "AUD" }), {
    label: "AUD 15.00 est. per sale · 30%",
    detail: "Based on a sale of AUD 49.99. Actual commission depends on eligible sale value.",
  });
  assert.equal(summary({ price: 200, commissionValue: 15 }).label, "USD 60.00 est. per sale · 30%", "Current price supersedes stale stored estimates");
  assert.equal(summary({ price: 9.99, commission: 15, commissionValue: 1 }).label, "USD 1.50 est. per sale · 15%", "Use cents rather than rounded business-onboarding value");
  assert.equal(summary({ commissionValue: 15 }).label, "USD 15.00 est. per sale · 30%", "Legacy stored estimate remains labelled as an estimate");
  for (const overrides of [{}, { price: 0, commissionValue: 15 }, { price: -1 }, { price: NaN }, { price: Infinity }, { price: 100, currency: null }, { price: 100, currency: "invalid" }, { commissionValue: -20 }]) {
    assert.equal(summary(overrides).label, "30% commission");
  }
  assert.equal(summary({ price: 100, commission: 0, commissionValue: 15 }).label, "See offer terms");
  assert.equal(summary({ price: 100, commission: null, commissionValue: 15 }).label, "See offer terms");
  const recurring: Partial<OnboardingOffer> = { type: "recurring", commissionValue: 10, recurringMonthlyCommissionValue: 20, recurringTermMonths: 12, payoutMode: "upfront" };
  assert.deepEqual(summary(recurring), {
    label: "USD 240.00 per referral · 30%",
    detail: "USD 20.00/month for 12 months · Paid upfront · Offer terms apply",
  });
  assert.deepEqual(summary({ ...recurring, payoutMode: "spread" }), {
    label: "USD 20.00/month · 30%",
    detail: "USD 20.00/month for 12 months · Paid monthly · Offer terms apply",
  });
  assert.equal(summary({ ...recurring, recurringMonthlyCommissionValue: null, recurringTermMonths: null, payoutCycles: 3 }).label, "USD 30.00 per referral · 30%");
  assert.equal(summary({ type: "recurring", commissionValue: 10 }).label, "USD 10.00 per referral · 30%", "Legacy processor defaults to one month, not twelve");
  for (const overrides of [{ recurringTermMonths: -1 }, { recurringTermMonths: 1.5 }, { recurringTermMonths: Infinity }, { payoutMode: "unknown" }, { payoutInterval: "weekly" }, { recurringMonthlyCommissionValue: 0 }, { recurringMonthlyCommissionValue: NaN }]) {
    assert.equal(summary({ ...recurring, ...overrides }).label, "30% commission", "Malformed recurring terms must not imply earnings");
  }

  assert.equal(canUsePreapprovedOrganic(true, asset, "social", asset.caption), true);
  assert.equal(canUsePreapprovedOrganic(true, asset, "social", asset.caption, true), false);
  assert.equal(canUsePreapprovedOrganic(true, asset, "social", "Edited copy"), false);
  assert.equal(canUsePreapprovedOrganic(true, asset, "email", asset.caption), false);
  assert.equal(canUsePreapprovedOrganic(false, asset, "social", asset.caption), false);
  assert.equal(canUsePreapprovedOrganic(true, { ...asset, organic_preapproved: false }, "social", asset.caption), false);
  assert.equal(eligibleCreative({ ...asset, business_email: "other@example.test" }, offer, "organic"), false);
  assert.equal(eligibleCreative({ ...asset, offer_id: otherId }, offer, "organic"), false);
  assert.equal(eligibleCreative({ ...asset, archived_at: "2026-01-01" }, offer, "organic"), false);
  assert.equal(eligibleCreative({ ...asset, allow_paid: false }, offer, "paid"), false);
  const context = buildPromotionContext(offer, { business_name: "Bottle brand", stripe_customer_id: "exclude-billing" }, [asset, { ...asset, business_email: "other", caption: "exclude-other-brand" }], "organic");
  assert.equal(context.hasContext, true);
  assert.equal(context.context.brandName, "Bottle brand");
  for (const forbidden of ["exclude-secret", "exclude-billing", "exclude-other-brand", "brand@example.test", "bottle.jpg", '"commission"']) assert.ok(!JSON.stringify(context.context).includes(forbidden));
  assert.equal(buildPromotionContext({ ...offer, description: "" }, null, [], "organic").hasContext, false);
  assert.equal(validatePromotionPack(pack).hooks.length, 3);
  for (const invalid of [{ ...pack, hooks: ["one"] }, { ...pack, cta: "DELETE" }, { ...pack, cta: ["LEARN_MORE"] }, { ...pack, headline: "x".repeat(121) }, { ...pack, primaryAdCopy: " " }, { ...pack, approved: true }]) assert.throws(() => validatePromotionPack(invalid));

  const env: NodeJS.ProcessEnv = { NODE_ENV: "test", NETTMARK_AFFILIATE_AI_ENABLED: "true", OPENAI_API_KEY: "unit-test-key", UPSTASH_REDIS_REST_URL: "https://quota.example.test", UPSTASH_REDIS_REST_TOKEN: "unit-test-token" };
  const config = getPromotionAIConfig(env)!;
  assert.ok(config);
  assert.equal(getPromotionAIConfig({ ...env, NETTMARK_AFFILIATE_AI_ENABLED: "false" }), null);
  assert.equal(getPromotionAIConfig({ ...env, UPSTASH_REDIS_REST_TOKEN: "" }), null);
  assert.equal(getPromotionAIConfig({ ...env, UPSTASH_REDIS_REST_URL: "http://quota.example.test" }), null);
  assert.equal(getPromotionAIConfig({ ...env, NETTMARK_AI_DAILY_GLOBAL_LIMIT: "999999" })?.globalLimit, 100);

  const responseBody = { status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(pack) }] }], usage: { input_tokens: 40, output_tokens: 50 } };
  let sent: Record<string, unknown> = {};
  const successFetch: typeof fetch = async (_input, init) => { sent = JSON.parse(String(init?.body)); return Response.json(responseBody); };
  const generated = await generatePromotionPack(config, context.context, successFetch);
  assert.equal(generated.pack.headline, pack.headline);
  assert.equal(sent.store, false);
  assert.ok(JSON.stringify(sent.instructions).includes("untrusted"));
  assert.equal(generated.inputTokens, 40);
  for (const body of [
    { status: "incomplete", output: [] },
    { status: "completed", output: [{ type: "message", content: [{ type: "refusal" }] }] },
    { status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: "{}" }] }] },
  ]) await assert.rejects(() => generatePromotionPack(config, {}, async () => Response.json(body)), (error: unknown) => error instanceof PromotionAIError && error.status === 502);
  await assert.rejects(() => generatePromotionPack(config, {}, async () => new Response("provider failure", { status: 429 })), /could not generate/);
  await assert.rejects(() => generatePromotionPack(config, {}, async () => { throw new DOMException("timeout", "TimeoutError"); }), (error: unknown) => error instanceof PromotionAIError && error.status === 504);

  for (const result of [1, 2, 3]) await assert.rejects(
    () => reservePromotionQuota(config, userId, async () => Response.json({ result })),
    (error: unknown) => error instanceof PromotionAIError && error.status === 429,
  );
  await assert.rejects(() => reservePromotionQuota(config, userId, async () => Response.json({ error: "unavailable" })), /temporarily unavailable/);
  const commands: unknown[][] = [];
  const release = await reservePromotionQuota(config, userId, async (_input, init) => {
    commands.push(JSON.parse(String(init?.body))); return Response.json({ result: 0 });
  }, new Date("2026-10-03T12:00:00Z"), "request-nonce");
  assert.equal(commands[0][0], "EVAL");
  assert.equal(commands[0][2], 3);
  assert.equal(commands[0][8], 43200);
  await release();
  assert.equal(commands[1].at(-1), "request-nonce");

  // HTTP handlers run with mock authenticated clients and provider fetches.
  // No live database, emails, Redis, OpenAI, wallets or campaign writes are used.
  type Row = Record<string, unknown>;
  let tables: Record<string, Row[]> = {};
  let errors: Record<string, { message: string } | null> = {};
  let writes: string[] = [];
  let user: { id: string; email: string } | null = null;
  let authError: { message: string } | null = null;
  const database = {
    auth: { getUser: async () => ({ data: { user }, error: authError }) },
    from(table: string) {
      let rows = [...(tables[table] || [])];
      let mutation = false;
      const builder = {
        select: (_columns: string) => builder,
        eq: (column: string, value: unknown) => { rows = rows.filter(row => row[column] === value); return builder; },
        in: (column: string, values: unknown[]) => { rows = rows.filter(row => values.includes(row[column])); return builder; },
        is: (column: string, value: unknown) => { rows = rows.filter(row => row[column] == value); return builder; },
        or: (_expression: string) => builder,
        order: (_column: string, _options: unknown) => builder,
        limit: (count: number) => { rows = rows.slice(0, count); return builder; },
        insert: (_value: unknown) => { mutation = true; writes.push(table); return builder; },
        update: (_value: unknown) => { mutation = true; writes.push(table); return builder; },
        maybeSingle: async () => ({ data: rows[0] || null, error: errors[table] || null }),
        single: async () => ({ data: rows[0] || null, error: errors[table] || null }),
        then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: mutation ? null : rows, error: errors[table] || null }).then(resolve),
      };
      return builder;
    },
  };
  function reset() {
    user = { id: userId, email: "affiliate@example.test" }; authError = null; writes = []; errors = {};
    tables = { profiles: [{ id: userId, role: "affiliate", terms_accepted: true }],
      offers: [offer], affiliate_requests: [{ id: "request", offer_id: offerId, affiliate_email: user.email, status: "approved" }],
      business_profiles: [{ business_email: offer.business_email, business_name: "Bottle brand" }],
      business_creatives: [asset] };
  }
  type Loader = { _load: (id: string, parent: unknown, isMain: boolean) => unknown };
  const loader = Module as unknown as Loader;
  const originalLoad = loader._load;
  const originalFetch = globalThis.fetch;
  const originalEnv = { ...process.env };
  loader._load = function (id, parent, isMain) {
    if (id === "@supabase/auth-helpers-nextjs") return { createRouteHandlerClient: () => database };
    if (id === "next/headers") return { cookies: () => ({}) };
    if (id.includes("utils/supabase/server-client")) return database;
    if (id.includes("lib/email/send")) return { sendEmail: async () => {} };
    if (id.includes("lib/email/templates")) return { businessNewAffiliateRequestEmail: () => ({ subject: "", html: "" }) };
    return originalLoad.call(this, id, parent, isMain);
  };
  try {
    Object.assign(process.env, env);
    const route = require("../app/api/affiliate/offers/[offerId]/generate-promotion/route");
    const listRoute = require("../app/api/onboarding/affiliate-offers/route");
    const completionRoute = require("../app/api/profile/onboarding-complete/route");
    const startRoute = require("../app/api/affiliate/offers/[offerId]/start/route");
    const routeContext = { params: Promise.resolve({ offerId }) };
    const request = (body: unknown = { mode: "organic" }) => new Request("https://nettmark.test/api/generate", { method: "POST", body: JSON.stringify(body) });
    let providerCalls = 0;
    globalThis.fetch = async (input, init) => {
      if (String(input).includes("quota.example.test")) return Response.json({ result: 0 });
      assert.equal(String(input), "https://api.openai.com/v1/responses");
      providerCalls++;
      const payload = JSON.parse(String(init?.body));
      assert.ok(!payload.input.includes(offer.business_email));
      assert.ok(!payload.input.includes("exclude-secret"));
      return Response.json(responseBody);
    };
    reset();
    assert.equal((await route.POST(new Request("https://nettmark.test/api/generate", { method: "POST", headers: { origin: "https://foreign.test" }, body: '{"mode":"organic"}' }), routeContext)).status, 403);
    reset(); user = null;
    assert.equal((await route.POST(request(), routeContext)).status, 401);
    reset(); authError = { message: "invalid session" };
    assert.equal((await route.POST(request(), routeContext)).status, 401);
    reset(); tables.profiles[0].role = "business";
    assert.equal((await route.POST(request(), routeContext)).status, 403);
    assert.equal((await startRoute.POST(request(), routeContext)).status, 403);
    assert.equal((await listRoute.GET()).status, 403);
    reset();
    for (const status of ["pending", "rejected", "revoked"]) {
      tables.affiliate_requests[0].status = status;
      assert.equal((await route.POST(request(), routeContext)).status, 403);
    }
    reset(); errors.affiliate_requests = { message: "database failed" };
    assert.equal((await route.POST(request(), routeContext)).status, 503);
    reset(); tables.offers[0] = { ...offer, status: "draft" };
    assert.equal((await route.POST(request(), routeContext)).status, 409);
    reset();
    assert.equal((await route.POST(request(), { params: Promise.resolve({ offerId: "bad" }) })).status, 400);
    assert.equal((await route.POST(request({ mode: "organic", description: "client invented context" }), routeContext)).status, 400);
    assert.equal((await route.POST(request({ mode: "paid", creativeId: otherId }), routeContext)).status, 403);
    tables.offers[0] = { ...offer, description: "" }; tables.business_creatives = [];
    assert.equal((await route.POST(request(), routeContext)).status, 422);
    assert.equal(providerCalls, 0);
    reset(); process.env.NETTMARK_AFFILIATE_AI_ENABLED = "false";
    assert.equal((await (await route.GET(request(), routeContext)).json()).available, false);
    assert.equal((await route.POST(request(), routeContext)).status, 503);
    process.env.NETTMARK_AFFILIATE_AI_ENABLED = "true";
    const response = await route.POST(request({ mode: "organic", creativeId }), routeContext);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).pack.organicCaption, pack.organicCaption);
    assert.equal(providerCalls, 1);
    assert.deepEqual(writes, []);

    reset();
    const listed = await (await listRoute.GET()).json();
    assert.equal(listed.offers[0].id, offerId);
    assert.equal(listed.offers[0].readyOrganicCount, 1);
    tables.offers[0] = { ...offer, price: "49.99", currency: "AUD", commission_value: "15",
      recurring_monthly_commission_value: "20", recurring_term_months: "12", payout_cycles: "12",
      payout_mode: "spread", payout_interval: "monthly" };
    const amounts = (await (await listRoute.GET()).json()).offers[0];
    assert.equal(amounts.price, 49.99);
    assert.equal(amounts.commissionValue, 15);
    assert.equal(amounts.currency, "AUD");
    assert.equal(amounts.recurringMonthlyCommissionValue, 20);
    assert.equal(amounts.recurringTermMonths, 12);
    assert.equal(amounts.payoutCycles, 12);
    assert.equal(amounts.payoutMode, "spread");
    assert.equal(amounts.payoutInterval, "monthly");
    assert.ok(!JSON.stringify(amounts).includes("exclude-secret"));
    tables.offers[0] = { ...offer, price: "bad", commission_value: Infinity };
    const missingAmounts = (await (await listRoute.GET()).json()).offers[0];
    assert.equal(missingAmounts.price, null);
    assert.equal(missingAmounts.commissionValue, null);

    assert.ok(!JSON.stringify(listed).includes(offer.business_email));
    errors.offers = { message: "database failed" };
    assert.equal((await listRoute.GET()).status, 503);
    reset(); tables.offers[0] = { ...offer, participation_mode: "private" }; tables.affiliate_requests = [];
    assert.equal((await (await listRoute.GET()).json()).offers.length, 0);

    reset();
    const completed = await completionRoute.POST();
    assert.equal(completed.status, 200);
    assert.equal(completed.headers.get("set-cookie"), null);
    assert.deepEqual(writes, ["profiles"]);
    reset(); user = null;
    assert.equal((await completionRoute.POST()).status, 401);
    reset(); errors.profiles = { message: "failed" };
    assert.equal((await completionRoute.POST()).status, 503);
    assert.deepEqual(writes, []);

    reset(); tables.affiliate_requests[0].status = "pending"; tables.offers[0] = { ...offer, participation_mode: "approval_required" };
    const pending = await startRoute.POST(request(), routeContext);
    assert.equal(pending.status, 200);
    assert.equal((await pending.json()).promotePath, null);
    assert.ok(!writes.some(table => table === "live_campaigns"));
    reset(); tables.affiliate_requests[0].status = "rejected";
    assert.equal((await startRoute.POST(request(), routeContext)).status, 403);
  } finally {
    loader._load = originalLoad; globalThis.fetch = originalFetch;
    for (const key of Object.keys(process.env)) if (!(key in originalEnv)) delete process.env[key];
    Object.assign(process.env, originalEnv);
  }
  console.log("Affiliate onboarding and AI regression tests passed");
}
void main().catch(error => { console.error(error); process.exitCode = 1; });
