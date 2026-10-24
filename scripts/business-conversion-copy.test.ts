import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
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
// Catch label/value claims even when JSX markup separates them.
const zeroAdSpend = /ad spend[\s\S]{0,300}?\$0(?=[^\d]|$)/i;
assert.match('<div>Ad spend</div><div className="value">$0</div>', zeroAdSpend);
assert.doesNotMatch('<div>Ad spend</div><div>Funded from affiliate wallet</div>', zeroAdSpend);
// Scan source files too: email row labels and values can split a claim.
function checkAdSpendCopy(directory: string) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) checkAdSpendCopy(path);
    else if (/\.(tsx?|html|md)$/.test(entry.name)) {
      const source = read(path);
      if (path.startsWith("app/") && entry.name.endsWith(".tsx")) {
        assert.doesNotMatch(source, zeroAdSpend, path);
      }
      assert.doesNotMatch(source, /ad spend:? \$0|ad spend remains \$0|A\$0 ad spend|not charged to your card/i, path);
      assert.doesNotMatch(source, /label: "Your ad spend", value: "\$0"/i, path);
    }
  }
}
for (const directory of ["app", "components", "utils", "emails"]) {
  if (existsSync(directory)) checkAdSpendCopy(directory);
}
for (const path of [
  "app/api/affiliate/ad-ideas/notify-submitted/route.ts",
  "app/api/affiliate/offers/[offerId]/paid-promotion-request/route.ts",
  "app/business/my-business/ad-ideas/[id]/page.tsx",
]) assert.match(read(path), /Ad spend is funded from the affiliate’s wallet: Meta bills your connected ad account and Nettmark pays that spend back/);
assert.ok(demo.includes("Let affiliates fund your advertising."));
assert.ok(landing.includes("Get sales from affiliate-funded Meta ads."));
for (const s of [demo, landing, read("app/pricing/page.tsx")]) assert.doesNotMatch(s, /without paying for|never pay for|No upfront|you pay: A\$0|Paid by affiliate|don.t pay a cent|prepay|cover spend|covers spend/i);
assert.doesNotMatch(landing, /Trusted by growth teams|"DTC"/);
assert.match(landing, /stats &&/);
assert.match(read("app/create-account/page.tsx"), /resolveBusinessPlanChoice\(sp.get\('plan'\)\)/);
assert.match(picker, /useState<"free" \| "growth">\("growth"\)/);
assert.match(picker, /resolveBusinessPlanChoice\(new URLSearchParams\(window.location.search\).get\("plan"\)\)/);
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
