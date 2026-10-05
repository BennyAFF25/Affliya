import * as assert from "node:assert/strict";
import { buildStartTrial, checkoutMatching, hashMeta, sendStartTrial, retryDelaySeconds, TrialSubscription } from "../utils/marketing/startTrial";
const now = 1791187200;
const subscription: TrialSubscription = {
  id: "sub_fixture", livemode: true, status: "trialing", trial_start: now, trial_end: now + 14 * 86400,
  metadata: { nettmark_platform: "nettmark", nettmark_action: "business_subscription", business_id: "business_fixture", user_id: "user_fixture", business_email: "Owner@realbrand.com" },
  items: { data: [{ price: { id: "price_fixture" }, quantity: 1 }] },
};
const params = { subscription, eventLivemode: true, businessId: "business_fixture", userId: "user_fixture", email: " OWNER@realbrand.com ", priceId: "price_fixture", trialDays: 14, now };
const payload = buildStartTrial(params)!;
assert.equal(payload.event_name, "StartTrial");
assert.equal(payload.event_time, now);
assert.equal(payload.user_data.em[0], hashMeta("owner@realbrand.com"));
assert.equal(payload.user_data.external_id[0], hashMeta("user_fixture"));
assert.ok(!("custom_data" in payload));
assert.equal(buildStartTrial({ ...params, subscription: { ...subscription, id: "sub_recreated" } })!.event_id, payload.event_id);
for (const status of ["active", "incomplete", "incomplete_expired", "canceled", "past_due"]) {
  assert.equal(buildStartTrial({ ...params, subscription: { ...subscription, status } }), null);
}
assert.equal(buildStartTrial({ ...params, eventLivemode: false }), null);
assert.equal(buildStartTrial({ ...params, subscription: { ...subscription, livemode: false } }), null);
assert.equal(buildStartTrial({ ...params, priceId: "other" }), null);
assert.equal(buildStartTrial({ ...params, subscription: { ...subscription, trial_end: null } }), null);
assert.equal(buildStartTrial({ ...params, subscription: { ...subscription, trial_end: now + 7 * 86400 } }), null);
assert.equal(buildStartTrial({ ...params, now: now + 7 * 86400 }), null);
assert.equal(buildStartTrial({ ...params, subscription: { ...subscription, metadata: { ...subscription.metadata, business_id: "other" } } }), null);
for (const email of ["ben@falconx.com.au", "support@nettmark.com", "test@realbrand.com", "owner@example.com", "owner@company.test"]) {
  const input = { ...params, email, subscription: { ...subscription, metadata: { ...subscription.metadata, business_email: email } } };
  assert.equal(buildStartTrial(input), null);
  assert.ok(buildStartTrial({ ...input, allowInternalForTest: true }));
}
const fbp = "fb.1." + now * 1000 + ".123456789";
const fbc = "fb.1." + now * 1000 + ".actualClick";
const matching = checkoutMatching(new Request("https://www.nettmark.com/api/checkout", {
  headers: { cookie: "_fbp=" + fbp + "; _fbc=" + fbc, "x-vercel-forwarded-for": "203.0.113.4", "user-agent": "Fixture browser" },
}), now * 1000);
assert.deepEqual(matching, { fbp, fbc, client_ip_address: "203.0.113.4", client_user_agent: "Fixture browser" });
assert.deepEqual(checkoutMatching(new Request("https://www.nettmark.com", { headers: { cookie: "_fbp=invalid; _fbc=%ZZ", "x-forwarded-for": "203.0.113.4" } }), now * 1000), {});
assert.equal(buildStartTrial({ ...params, matching })!.user_data.fbc, fbc);
assert.equal(retryDelaySeconds(1), 60);
assert.equal(retryDelaySeconds(10), 1800);

async function run() {
  let sent: Record<string, unknown> | undefined;
  const fetcher: typeof fetch = async (_url, init) => {
    assert.ok(String(_url).endsWith("/465823834246251/events"));
    assert.ok(!String(_url).includes("fixture-secret"));
    assert.equal((init?.headers as Record<string, string>).Authorization, "Bearer fixture-secret");
    sent = JSON.parse(String(init?.body));
    return Response.json({ events_received: 1 });
  };
  assert.deepEqual(await sendStartTrial({ payload, token: "fixture-secret", pixelId: "465823834246251", fetcher }), { ok: true, error: null });
  assert.deepEqual(sent, { data: [payload] });
  await sendStartTrial({ payload, token: "fixture-secret", pixelId: "465823834246251", testEventCode: "TEST_fixture", fetcher });
  assert.equal(sent?.test_event_code, "TEST_fixture");
  assert.equal((await sendStartTrial({ payload, token: "fixture-secret", pixelId: "465823834246251", fetcher: async () => new Response("secret error", { status: 500 }) })).error, "meta_http_500");
  assert.equal((await sendStartTrial({ payload, token: "fixture-secret", pixelId: "465823834246251", fetcher: async () => Response.json({}) })).error, "meta_ack_missing");
  assert.equal((await sendStartTrial({ payload, token: "fixture-secret", pixelId: "465823834246251", fetcher: async () => { throw new Error("secret"); } })).error, "meta_request_failed");
  assert.equal((await sendStartTrial({ payload, token: "", pixelId: "465823834246251", fetcher })).error, "configuration_missing");
  console.log("Meta StartTrial payload, eligibility, matching and delivery tests passed");
}
run().catch(error => { console.error(error); process.exitCode = 1; });
