import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  validateLaunchProposal,
  buildSavedMetaTargeting,
  buildSavedMetaCreative,
} from "../utils/meta/campaignConfiguration";

// A copy of non-sensitive campaign settings from QA proposal edabafdf.
// Test never connects to Meta, Supabase, wallets, or production data.
const start = new Date(Date.now() + 24 * 60 * 60_000).toISOString();
const end = new Date(Date.now() + 14 * 24 * 60 * 60_000).toISOString();
const proposal = {
  campaign_name: "Nettmark Partner | QA retest 2 | 11 Oct | AU-NZ",
  headline: "Get sales without paying for the ads.",
  caption: "Affiliates fund and run Meta ads for your brand. You approve every ad.",
  call_to_action: "LEARN_MORE",
  display_link: "https://www.nettmark.com/for-businesses",
  tracking_link: "https://www.nettmark.com/go/test-offer___test-affiliate",
  file_url: "https://example.com/creative.png",
  media_type: "IMAGE",
  objective: "OUTCOME_TRAFFIC",
  budget_amount: 1500,
  budget_type: "DAILY",
  currency: "AUD",
  start_time: start,
  end_time: end,
  location: "AU,NZ",
  age_range: ["25", "55"],
  gender: "All",
  advantage_audience: false,
  interests: JSON.stringify([
    { id: "6003371567474", name: "Entrepreneurship (business and finance)" },
    { id: "6003127206524", name: "Digital marketing (marketing)" },
    { id: "6002884511422", name: "Small business (business and finance)" },
  ]),
  placements_type: "MANUAL",
  manual_placements: ["facebook_feed", "instagram_feed"],
};
const validation = validateLaunchProposal(proposal, { currency: "AUD" });
assert.deepEqual(validation.errors, []);
assert.equal(validation.ok, true);

const creative = buildSavedMetaCreative(proposal);
assert.equal(creative.headline, "Get sales without paying for the ads.");
assert.notEqual(creative.headline, proposal.campaign_name);
assert.equal(creative.caption, proposal.caption);
assert.equal(creative.ctaType, "LEARN_MORE");
assert.equal(creative.destinationLink, proposal.tracking_link);
assert.equal(creative.displayLink, proposal.display_link);

const targeting = buildSavedMetaTargeting(proposal);
assert.deepEqual(targeting.geo_locations.countries, ["AU", "NZ"]);
assert.equal(targeting.age_min, 25);
assert.equal(targeting.age_max, 55);
assert.deepEqual(targeting.genders, [1, 2]);
assert.deepEqual(targeting.publisher_platforms, ["facebook", "instagram"]);
assert.deepEqual(targeting.facebook_positions, ["feed"]);
assert.deepEqual(targeting.instagram_positions, ["stream"]);
assert.deepEqual(targeting.targeting_automation, { advantage_audience: 0 });
assert.deepEqual(targeting.flexible_spec, [{
  interests: [{ id: "6003371567474" }, { id: "6003127206524" }, { id: "6002884511422" }],
}]);

const bad = (patch: Record<string, unknown>) =>
  validateLaunchProposal({ ...proposal, ...patch }, { currency: "AUD" });
for (const patch of [
  { headline: "" }, { caption: "" }, { call_to_action: "" },
  { display_link: "" }, { tracking_link: "" }, { file_url: "" },
  { age_range: [] }, { location: "" }, { gender: "" },
  { advantage_audience: null }, { manual_placements: [] },
  { budget_amount: 0 }, { start_time: "" },
  { currency: "USD" },
  { interests: JSON.stringify(["plain text"]) },
]) {
  assert.equal(bad(patch).ok, false, JSON.stringify(patch));
}

// Verify that the real launch routes use the tested deterministic mappers,
// rather than parallel body-driven mappings or silent default substitutes.
const launch = readFileSync("app/api/business/ad-ideas/launch/route.ts", "utf8");
const upload = readFileSync("app/api/meta/callback/upload-video/route.ts", "utf8");
const readiness = readFileSync("app/api/business/ad-ideas/review-readiness/route.ts", "utf8");
assert.ok(launch.includes("const configuration = validateLaunchProposal(idea"));
assert.ok(launch.indexOf("const configuration = validateLaunchProposal(idea") <
  launch.indexOf('.update({ status: "approved" })'));
assert.ok(upload.includes("const intentCheck = validateLaunchProposal(adIdea as any"));
assert.ok(upload.indexOf("const intentCheck = validateLaunchProposal(adIdea as any") <
  upload.indexOf("const createCampaignRes = await fetch("));
assert.ok(upload.includes("buildSavedMetaCreative(adIdea as any)"));
assert.ok(upload.includes("buildSavedMetaTargeting(adIdea as any)"));
assert.ok(upload.includes("name: headline"));
assert.ok(upload.includes('message: caption'));
assert.ok(upload.includes('type: ctaType'));
assert.ok(upload.includes("link: destinationLink"));
assert.ok(readiness.includes("const configuration = validateLaunchProposal(idea"));
console.log("meta launch payload pure mapping tests passed (no Meta calls)");
