import assert from "node:assert/strict";
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

console.log("meta campaign configuration tests passed");
