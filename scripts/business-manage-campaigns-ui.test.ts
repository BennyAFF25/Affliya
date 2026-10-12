import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync("app/business/manage-campaigns/page.tsx", "utf8");
const workspace = readFileSync("components/business/ManageCampaignsWorkspace.tsx", "utf8");

assert.match(page, /<ManageCampaignsWorkspace/, "business page uses the new workspace");
assert.match(page, /from\("live_campaigns"\)/, "organic campaigns retained");
assert.match(page, /from\("live_ads"\)/, "Meta paid campaigns retained");
assert.match(page, /from\("affiliate_shop_requests"\)/, "shops retained");
assert.match(page, /from\("ad_ideas"\)/, "paid creative thumbnail/headline obtained from saved proposal");
assert.match(page, /handleToggleStatus/, "organic pause retained");
assert.match(page, /handlePermanentStop/, "paid stop retained");
assert.match(page, /\/api\/meta\/control-ad/, "Meta stop uses existing authorised API");
assert.match(page, /\/api\/meta\/ad-insights/, "Meta sync uses existing API");

assert.match(workspace, /function MetaMark/, "Meta infinity branding present");
assert.match(workspace, /gridColumns/, "compact desktop table");
assert.match(workspace, /xl:hidden/, "mobile campaign card layout");
assert.match(workspace, /overflow-x-auto xl:block/, "desktop table cannot escape container");
assert.match(workspace, /aria-label="Campaign type"/, "filter tabs are accessible");
assert.match(workspace, /aria-label="Sort campaigns"/, "sorting available");
assert.match(workspace, /placeholder="Search campaigns/, "campaign search");
assert.match(workspace, /Shopfront placements/, "shop placements still reachable");
assert.match(workspace, /Meta clicks/, "Meta click metric honestly attributed");
assert.match(workspace, /item\._source === "meta" \? Number\(item\.clicks/, "stored Meta clicks used");
assert.doesNotMatch(workspace, /from\("campaign_tracking_events"\)/, "landing visits never presented as Meta clicks");
assert.match(workspace, /disabled=\{stopped\}/, "stopped Meta ads cannot be stopped again");
assert.match(workspace, /disabled=\{!isLive\(campaign\)\}/, "paused organic posts cannot be paused again");
console.log("business Manage Campaigns UI regression checks passed");
