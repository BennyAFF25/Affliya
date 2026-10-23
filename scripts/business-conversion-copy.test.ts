import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Module from "node:module";
const read = (path: string) => readFileSync(path, "utf8");
const demo = read("app/components/marketing/BusinessDemoLandingPage.tsx");
const landing = read("app/for-businesses/ForBusinessesLandingPage.tsx");
const picker = read("app/business/choose-plan/page.tsx");
const trial = read("components/business/BusinessTrialFirstContinuation.tsx");
for (const source of [demo, landing, picker, trial]) {
  assert.ok(source.includes("Start my affiliate-funded launch, 14 days free"));
  assert.ok(source.includes("A$49/mo after day 14 only if you stay. Card required."));
  assert.ok(source.includes("The 14-Day Affiliate-Funded Launch"));
  assert.doesNotMatch(source, /A\$0 ad spend/);
}
assert.ok(demo.includes("Let affiliates fund your advertising."));
assert.ok(landing.includes("Get sales without paying for the ads."));
assert.doesNotMatch(landing, /Trusted by growth teams|"DTC"/);
assert.match(landing, /stats &&/);
assert.match(read("app/create-account/page.tsx"), /sp.get\('plan'\) === 'free' \? 'free' : 'growth'/);
assert.match(picker, /plan === "free" \|\| plan === "growth"/);
for (const source of [picker, trial]) {
  assert.ok(source.includes("Organic affiliates only, no paid ads"));
  assert.ok(source.includes("We ask for a card to keep fake brands out, so affiliates can trust every offer."));
}
let offerCount: number | null = 90, affiliateCount: number | null = 74, error = false, throws = false;
const calls: unknown[] = [];
const original = (Module as any)._load;
(Module as any)._load = function(id: string, ...args: any[]) {
  if (id === "next/cache") return { unstable_cache: (fn: any, keys: any, options: any) => {
    assert.equal(options.revalidate, 3600); return fn;
  } };
  if (id.endsWith("supabase/createServerClient")) return { createServerSupabaseClient: () => {
    if (throws) throw new Error("unavailable");
    return { from: (table: string) => ({ select: (columns: string, options: any) => {
      assert.equal(columns, "id"); assert.deepEqual(options, { count: "exact", head: true });
      const result = { count: table === "offers" ? offerCount : affiliateCount, error: error ? {} : null };
      return { neq: (key: string, value: string) => { calls.push([table,key,value]); return Promise.resolve(result); },
        eq: (key: string, value: string) => { calls.push([table,key,value]); return Promise.resolve(result); } };
    } }) };
  } };
  return original.call(this, id, ...args);
};
async function main() {
  try {
    const { getMarketplaceCounts } = await import("../utils/marketing/marketplaceCounts");
    assert.deepEqual(await getMarketplaceCounts(), { offers: 90, affiliates: 74 });
    assert.deepEqual(calls, [["offers", "participation_mode", "private"], ["profiles", "role", "affiliate"]]);
    error = true; assert.equal(await getMarketplaceCounts(), null); error = false;
    offerCount = null; assert.equal(await getMarketplaceCounts(), null);
    offerCount = 0; assert.equal(await getMarketplaceCounts(), null);
    offerCount = 90; affiliateCount = null; assert.equal(await getMarketplaceCounts(), null);
    throws = true; assert.equal(await getMarketplaceCounts(), null);
    console.log("Business conversion copy and aggregate counts passed");
  } finally { (Module as any)._load = original; }
}
void main();
