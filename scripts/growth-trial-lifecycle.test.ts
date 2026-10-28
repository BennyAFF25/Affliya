import assert from "node:assert/strict";
import Module from "node:module";
import { selectGrowthTrialReminder as select, shouldAlertFounder } from "../utils/growthTrialLifecycle";

for (const age of [1, 1.5, 1.999]) {
  assert.equal(select(age, 0)?.eventType, "growth_trial_reminder_day_1");
  assert.equal(select(age, 1), null);
}
for (const age of [0, 0.999, 2, 2.999, 4, 9.999, 11, 13, NaN]) assert.equal(select(age, 0), null);
assert.equal(select(3, 0)?.variant, "3-no-offer");
assert.equal(select(3.999, 1)?.variant, "3");
assert.deepEqual(select(3, 0)?.dedupeEventTypes, select(3, 1)?.dedupeEventTypes);
for (const day of [10, 12]) for (const offers of [0, 1]) {
  assert.equal(select(day, offers)?.eventType, `growth_trial_reminder_day_${day}`);
  assert.equal(select(day + 0.999, offers)?.noOffer, false);
}
assert.equal(shouldAlertFounder(2 / 24, 0), true);
assert.equal(shouldAlertFounder((2 * 3600000 - 1) / 86400000, 0), false);
assert.equal(shouldAlertFounder(3, 1), false);

const now = Date.now();
let ageMs = 86400000, offers = 0, cohort = true, pending = 0;
let founderError = false;
const events: any[] = [], sends: any[] = [];
const db = {
  auth: { admin: { getUserById: async () => ({ data: { user: { user_metadata: { business_plan_first_v2: cohort } } } }) } },
  from(table: string) {
    const filters: Array<(event: any) => boolean> = [];
    const result = () => table === "business_entitlements"
      ? { data: [{ business_id: "brand", business_email: "Brand@example.test", growth_trial_started_at: new Date(now - ageMs).toISOString(), subscription_current_period_end: new Date(now + 86400000).toISOString() }] }
      : table === "offers" ? { count: offers } : table === "ad_ideas" ? { count: pending }
      : { data: events.find(e => filters.every(f => f(e))) || null };
    const q: any = {
      select: () => q, gte: () => q, order: () => q, limit: () => q,
      ilike: (column: string, address: string) => { assert.equal(column, "business_email"); assert.equal(address, "Brand@example.test"); return q; },
      eq: (column: string, value: string) => { filters.push(e => (column === "meta->>business_id" ? e.meta.business_id : e[column]) === value); return q; },
      in: (column: string, values: string[]) => { filters.push(e => values.includes(e[column])); return q; },
      maybeSingle: async () => result(),
      then: (resolve: any, reject: any) => Promise.resolve(result()).then(resolve, reject),
      insert: async (event: any) => { events.push({ id: events.length + 1, ...event }); return {}; },
    };
    return q;
  },
};
const loader = Module as unknown as { _load: (...args: any[]) => any };
const original = loader._load;
loader._load = function(name, ...args) {
  if (name.endsWith("/utils/businessSubscriptions")) return { createServerSupabaseClient: () => db };
  if (name === "resend") return { Resend: class { emails = { send: async (message: any, options: any) => {
    if (founderError && options.idempotencyKey.startsWith("founder-")) return { error: { message: "failed" } };
    sends.push({ ...message, ...options }); return { error: null };
  } }; } };
  return original.call(this, name, ...args);
};
process.env.CRON_SECRET = "test-secret";
process.env.RESEND_API_KEY = "test-key";
process.env.RESEND_FROM_EMAIL = "test@example.test";
process.env.ADMIN_NOTIFY_EMAIL = "admin@example.test";
const RealDate = Date;
// Freeze cron time so the exact two-hour boundary is deterministic.
global.Date = class extends RealDate { constructor(value?: any) { super(value === undefined ? now : value); } static now() { return now; } } as DateConstructor;
async function run() {
  try {
    const { GET } = require("../app/api/business-subscription/trial-reminders/route");
    const invoke = async () => {
      const response = await GET(new Request("https://example.test/cron", { headers: { authorization: "Bearer test-secret" } }));
      return response.json();
    };
    await invoke();
    assert.deepEqual(sends.map(s => s.idempotencyKey), ["founder-trial-no-offer/brand", "growth-trial-1/brand"]);
    assert.equal(sends[1].subject, "Your offer isn't live yet — finish it in 2 minutes");
    assert.match(sends[1].html, /Finish my offer/);
    assert.match(sends[1].html, /Manage billing or cancel trial/);
    assert.match(sends[1].html, /https:\/\/billing\.stripe\.com\/p\/login\//);
    await invoke(); assert.equal(sends.length, 2, "second run sends nothing");
    events.length = sends.length = 0; cohort = false; ageMs = 7200000 - 1;
    await invoke(); assert.equal(sends.length, 0);
    ageMs = 7200000; await invoke(); await invoke();
    assert.equal(sends.length, 1, "founder alert exactly once at two hours outside signup cohort");
    events.length = sends.length = 0; cohort = true; ageMs = 3 * 86400000; pending = 1;
    await invoke(); assert.equal(sends[1].idempotencyKey, "growth-trial-3-no-offer/brand");
    offers = 1; pending = 0; await invoke(); assert.equal(sends.length, 2, "variant change cannot resend day 3");
    events.length = sends.length = 0;
    await invoke(); assert.equal(sends[0].idempotencyKey, "growth-trial-3/brand");
    offers = 0; await invoke(); assert.equal(sends.length, 2, "reverse variant change sends only founder alert");
    events.length = sends.length = 0; founderError = true; ageMs = 86400000;
    const result = await invoke(); assert.equal(result.failed, 1); assert.equal(sends[0].idempotencyKey, "growth-trial-1/brand");
    events.length = sends.length = 0; delete process.env.ADMIN_NOTIFY_EMAIL;
    await invoke(); assert.equal(sends.length, 1, "missing admin address silently skips founder alert");
    offers = 1; pending = 1; ageMs = 3 * 86400000;
    events.length = sends.length = 0;
    await invoke(); assert.equal(sends.length, 0, "existing-offer day 3 still skips pending proposals");
    ageMs = 10 * 86400000; pending = 0;
    await invoke(); assert.equal(sends.length, 0, "day 10 still requires a proposal");
    pending = 1; await invoke(); assert.equal(sends[0].idempotencyKey, "growth-trial-10/brand");
    ageMs = 12 * 86400000; pending = 0;
    await invoke(); assert.equal(sends[1].idempotencyKey, "growth-trial-12/brand");
    assert.match(sends[1].html, /Manage billing or cancel trial/);
    assert.match(sends[1].html, /https:\/\/billing\.stripe\.com\/p\/login\//);
    assert.match(sends[1].html, /using your billing email/);
    assert.doesNotMatch(sends[1].html, /href="https:\/\/www\.nettmark\.com\/business\/settings"/);
    console.log("Growth trial lifecycle: pure selection, boundaries, route idempotency and failure isolation passed");
  } finally { loader._load = original; global.Date = RealDate; }
}
void run().catch(error => { console.error(error); process.exitCode = 1; });
