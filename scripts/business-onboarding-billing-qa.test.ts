import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { COUNTRIES, matchesCountryQuery, normaliseCountry } from "../utils/countries";
import { getSiteUrl } from "../utils/getSiteUrl";
import { buildTrackingUrl, displayTrackingUrl } from "../utils/tracking/buildTrackingUrl";
import { organicCaptionError, ORGANIC_CAPTION_ERROR } from "../utils/organicCaption";
import { needsOrganicPostReview } from "../utils/organicCampaignIdentity";

for (const [code, aliases] of Object.entries({ GB: ["UK", "Britain", "Great Britain", "England"], US: ["US", "USA", "America", "United States of America"] })) {
  const country = COUNTRIES.find(c => c.code === code)!;
  for (const alias of aliases) {
    assert(matchesCountryQuery(country, ` ${alias.toUpperCase()} `));
    assert.equal(normaliseCountry(alias), code);
  }
  assert(matchesCountryQuery(country, country.name.slice(2, 7)));
  assert(matchesCountryQuery(country, ""));
  assert(!matchesCountryQuery(country, "not a country"));
}
const keys = ["NEXT_PUBLIC_SITE_URL", "NEXT_PUBLIC_APP_URL", "NEXT_PUBLIC_BASE_URL", "VERCEL_URL", "NEXT_PUBLIC_VERCEL_URL", "VERCEL_BRANCH_URL", "NEXT_PUBLIC_VERCEL_BRANCH_URL", "VERCEL_ENV", "NEXT_PUBLIC_VERCEL_ENV"];
const saved = keys.map(key => process.env[key]);
try {
  for (const key of keys) delete process.env[key];
  assert.equal(getSiteUrl(), "https://www.nettmark.com");
  process.env.VERCEL_URL = "preview.example.test/";
  process.env.VERCEL_ENV = "production";
  assert.equal(getSiteUrl(), "https://www.nettmark.com");
  process.env.VERCEL_ENV = "preview";
  assert.equal(buildTrackingUrl({ campaignId: "test/id", affiliateId: "private" }), "https://preview.example.test/go/test%2Fid");
  process.env.VERCEL_BRANCH_URL = "branch-alias.example.test";
  assert.equal(getSiteUrl(), "https://branch-alias.example.test");
  delete process.env.VERCEL_BRANCH_URL;
  const runtimeId = "11111111-1111-4111-8111-111111111111";
  assert.equal(displayTrackingUrl(`https://www.nettmark.com/go/${runtimeId}___private@example.test`), `https://preview.example.test/go/${runtimeId}`);
  delete process.env.VERCEL_URL;
  delete process.env.VERCEL_ENV;
  process.env.NEXT_PUBLIC_VERCEL_ENV = "preview";
  process.env.NEXT_PUBLIC_VERCEL_URL = "client-preview.example.test";
  assert.equal(getSiteUrl(), "https://client-preview.example.test");
  process.env.NEXT_PUBLIC_BASE_URL = "https://base.example.test///";
  assert.equal(getSiteUrl(), "https://base.example.test");
  process.env.NEXT_PUBLIC_APP_URL = "https://app.example.test/";
  assert.equal(getSiteUrl(), "https://app.example.test");
  process.env.NEXT_PUBLIC_SITE_URL = " https://site.example.test/// ";
  process.env.VERCEL_ENV = "production";
  assert.equal(getSiteUrl(), "https://site.example.test");
} finally {
  keys.forEach((key, index) => { if (saved[index] === undefined) delete process.env[key]; else process.env[key] = saved[index]; });
}
for (const value of [42, {}, []]) assert.equal(organicCaptionError(value), "Caption must be text.");
for (const value of [null, undefined, "", "a".repeat(500)]) assert.equal(organicCaptionError(value), null);
assert.equal(organicCaptionError("a".repeat(501)), ORGANIC_CAPTION_ERROR);
assert.equal(organicCaptionError("😀".repeat(251)), ORGANIC_CAPTION_ERROR);
const post = { id: "post", campaign_id: "orphan", status: "approved", offer_id: "offer", business_email: "brand", affiliate_email: "affiliate" };
const campaign = { ...post, id: "post", type: "organic" };
assert(needsOrganicPostReview(post, []));
assert(!needsOrganicPostReview(post, [campaign]));
assert(!needsOrganicPostReview(post, [{ ...campaign, id: "legacy" }]));
assert(needsOrganicPostReview({ ...post, status: "pending" }, [campaign]));
assert(!needsOrganicPostReview({ ...post, status: "rejected" }, []));
assert(needsOrganicPostReview(post, [{ ...campaign, affiliate_email: "someone else" }]));

const migration = readFileSync("supabase/migrations/20261112170000_organic_posts_guards.sql", "utf8");
const undo = readFileSync("supabase/undo/20261112170000_organic_posts_guards.undo.sql", "utf8");
for (const sql of [migration, undo]) { assert.match(sql, /^BEGIN;/); assert.match(sql, /COMMIT;\s*$/); }
assert.match(migration, /char_length\(NEW\.caption\) > 500\s+AND \(TG_OP = 'INSERT' OR NEW\.caption IS DISTINCT FROM OLD\.caption\)/);
assert.doesNotMatch(migration, /ADD CONSTRAINT organic_posts_caption_max_500/);
assert.match(migration, /current_user NOT IN \('service_role', 'postgres', 'supabase_admin'\)/);
assert.doesNotMatch(migration, /current_setting\('request\.jwt/);
assert.doesNotMatch(migration, /VALIDATE CONSTRAINT|SECURITY DEFINER/);
assert.match(migration, /SECURITY INVOKER\s+SET search_path = public, pg_temp/);
assert.match(migration, /NEW.status = 'approved'[\s\S]*TG_OP = 'INSERT'[\s\S]*OLD.status IS DISTINCT FROM 'approved'/);
assert.match(migration, /TG_OP = 'UPDATE'[\s\S]*NEW.campaign_id IS DISTINCT FROM OLD.campaign_id/);
assert.match(migration, /BEFORE INSERT OR UPDATE ON public.organic_posts/);
assert.match(migration, /RETURN NEW;/);
assert.match(undo, /DROP TRIGGER IF EXISTS organic_posts_write_guards ON public.organic_posts/);
assert.match(undo, /DROP FUNCTION IF EXISTS public.guard_organic_posts_writes\(\)/);
assert.match(undo, /DROP CONSTRAINT IF EXISTS organic_posts_caption_max_500/);
assert.doesNotMatch(undo, /DELETE FROM|DROP TABLE|UPDATE public/);

// Audit every browser module rather than a single page. Only literal rejection is
// allowed here: dynamic status values could accidentally reintroduce client approval.
function files(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory()
    ? files(join(directory, entry.name)) : /\.[jt]sx?$/.test(entry.name) ? [join(directory, entry.name)] : []);
}
let clientUpdates = 0;
for (const path of [...files("app"), ...files("components"), ...files("utils")]) {
  const source = readFileSync(path, "utf8");
  if (!/^[\s]*["']use client["']/.test(source)) continue;
  const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === "update") {
      const target = node.expression.expression.getText(ast);
      if (/\.from\(["']organic_posts["']\)/.test(target)) {
        clientUpdates++;
        const value = node.arguments[0];
        assert(value && ts.isObjectLiteralExpression(value), `${path}: organic updates must be explicit`);
        const status = value.properties.find(property => ts.isPropertyAssignment(property) && property.name.getText(ast) === "status");
        if (status && ts.isPropertyAssignment(status)) {
          assert(ts.isStringLiteral(status.initializer) && status.initializer.text === "rejected", `${path}: approval belongs on the server`);
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(ast);
}
assert(clientUpdates > 0, "Audit must inspect the business rejection path");
const dashboard = readFileSync("app/business/my-business/page.tsx", "utf8");
assert.match(dashboard, /needsOrganicPostReview\(post, campaigns.data/);
assert.match(dashboard, /disabled=\{isEnablingPayouts \|\| \(!businessAccountId && !businessCountry\)\}/);
assert.match(dashboard, /if \(!businessAccountId && !businessCountry\) \{[\s\S]*?return;/);
for (const path of ["app/business/my-business/page.tsx", "app/affiliate/dashboard/promote/components/AdFormFields.tsx"]) {
  assert.match(readFileSync(path, "utf8"), /matchesCountryQuery\(country, /);
}
const ideas = readFileSync("app/business/my-business/post-ideas/page.tsx", "utf8");
assert.match(ideas, /post.status === "pending" && <Button[\s\S]*?"rejected"/);
assert.match(ideas, /selectedPost.status === "pending" && <button[\s\S]*?"rejected"/);

for (const path of [...files("app"), ...files("utils"), "scripts/backfill-stuck-organic-campaigns.ts"]) {
  assert(!readFileSync(path, "utf8").includes("https://www.nettmark.com/go/"), `${path}: generated tracking links must use the deployment origin`);
}
console.log("Business onboarding billing QA regression checks passed");
