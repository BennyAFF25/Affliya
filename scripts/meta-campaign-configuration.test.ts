import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateCampaignIntent, readMetaInterests } from "../utils/meta/campaignConfiguration";

const start = new Date(Date.now() + 15 * 60_000).toISOString();
const end = new Date(Date.now() + 15 * 86_400_000).toISOString();
const valid = {
  campaign_name: "Nettmark Partner",
  objective: "OUTCOME_TRAFFIC",
  budget_amount: 1500,
  budget_type: "DAILY",
  currency: "AUD",
  start_time: start,
  end_time: end,
  location: "AU,NZ",
  age_range: ["25", "55"],
  interests: JSON.stringify([{ id: "6003139266461", name: "Entrepreneurship" }]),
  manual_placements: ["facebook_feed", "instagram_feed"],
  placements_type: "MANUAL",
  advantage_audience: false,
  media_type: "IMAGE",
  file_url: "https://example.com/creative.png",
  call_to_action: "LEARN_MORE",
};
assert.equal(validateCampaignIntent(valid, { requireMedia: true }).ok, true);
assert.deepEqual(readMetaInterests(valid.interests), [
  { id: "6003139266461", name: "Entrepreneurship" },
]);

const check = (patch: Record<string, unknown>) =>
  validateCampaignIntent({ ...valid, ...patch }, { requireMedia: true });
assert.equal(check({ interests: JSON.stringify(["Small business"]) }).ok, false);
assert.equal(check({ age_range: ["25", "55"], advantage_audience: true }).ok, false);
assert.equal(check({ budget_amount: 0 }).ok, false);
assert.equal(check({ currency: "" }).ok, false);
assert.equal(check({ end_time: start }).ok, false);
assert.equal(check({ media_type: "IMAGE", file_url: "" }).ok, false);
assert.equal(check({ manual_placements: ["unknown"] }).ok, false);
assert.equal(check({ objective: "OUTCOME_VIDEO_VIEWS" }).ok, false);
assert.equal(check({ interests: "[broken" }).ok, false);
assert.equal(check({ call_to_action: "NO_BUTTON" }).ok, false);


const source = (path: string) => readFileSync(path, "utf8");
const estimateRoute = source("app/api/meta/estimate-reach/route.ts");
assert.ok(estimateRoute.includes("!/^[0-9]{2,30}$/.test(id)"), "Meta numeric interests must be accepted");
const affiliatePage = source("app/affiliate/dashboard/promote/[offerId]/page.tsx");
assert.ok(affiliatePage.includes('.select("business_email,currency")'), "Affiliate submit must fetch offer currency");
assert.ok(affiliatePage.includes("setSubmitError(message)"), "Submission errors must remain visible");
assert.ok(affiliatePage.includes('fetch("/api/affiliate/ad-ideas/create"'), "Submission must reach the authenticated proposal endpoint");
const wizard = source("app/affiliate/dashboard/promote/components/AdCampaignWizard.tsx");
assert.ok(wizard.includes("Campaign not submitted:"), "Wizard should render persistent error feedback");
assert.ok(wizard.includes("Starts:") && wizard.includes("Ends:") && wizard.includes("Placements:"),
  "Review must display schedule and placement choices");
const affiliateLayout = source("app/affiliate/layout.tsx");
assert.ok(affiliateLayout.includes('affiliateRole !== "affiliate"'),
  "Business accounts must not view affiliate screens");

console.log("meta campaign configuration tests passed");
