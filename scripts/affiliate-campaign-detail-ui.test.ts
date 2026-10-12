import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync("app/affiliate/dashboard/manage-campaigns/[campaignId]/page.tsx", "utf8");
const view = readFileSync("app/affiliate/dashboard/manage-campaigns/[campaignId]/CampaignDetailWorkspace.tsx", "utf8");
const metaMark = readFileSync("components/brand/MetaMark.tsx", "utf8");

// One consistent paid/organic layout, no legacy alternate full page.
assert.match(page, /return \(\s*<CampaignDetailWorkspace/);
assert.doesNotMatch(page, /if \(isOrganic\) \{\s*return \(/);
assert.doesNotMatch(page, /bg-\[#090b0c\]|bg-\[#0b1116\]|min-w-\[320px\] h-\[640px\]/);
assert.ok(page.split("\n").length < 800, "route's duplicate 2000+ line JSX removed");
assert.match(view, /isOrganic \? \(/, "media + metrics vary without separate pages");
assert.match(view, /lg:grid-cols-\[minmax\(0,0\.90fr\)_minmax\(0,1\.1fr\)\]/, "responsive detail columns");
assert.match(view, /grid-cols-2 gap-2\.5 xl:grid-cols-4/, "mobile KPI layout");
assert.match(view, /#151718/);
assert.match(view, /#101415/);
assert.match(view, /#00C2CB/);
assert.match(view, /<MetaMark/);
assert.match(metaMark, /#1688FA/);

// Paid Meta live controls and sync behaviour must survive the redesign.
assert.match(page, /\/api\/meta\/control-ad/);
assert.match(page, /actor: "affiliate"/);
assert.match(page, /\/api\/meta\/ad-insights/);
assert.match(view, /canControlMeta \? \(/);
assert.match(view, /stoppedByBusiness/);
assert.match(view, /onMetaControl\(isPaused \? "RESUME" : "PAUSE"\)/);
assert.match(view, /disabled=\{syncingSpend\}/);
assert.match(page, /refreshRecordedSpend/);
assert.match(page, /window\.setInterval\(refreshWhenVisible, 30_000\)/);
assert.doesNotMatch(page.slice(page.indexOf("const refreshRecordedSpend"),page.indexOf("// Meta control")), /\/api\/meta\/ad-insights|\/api\/ad-spend\/settle/);

// Tracking/accounting: never call unverified landing visits Meta clicks,
// and don't label commission estimate as payout.
assert.match(page, /isTrackedLandingVisit\(evt\)/);
assert.match(page, /\.eq\("campaign_id", currentCampaignId\)/);
assert.match(view, /label="Meta clicks"/);
assert.match(view, /campaign\.clicks/);
assert.match(view, /label="Landing visits"/);
assert.match(view, /stats\.clicks/);
assert.match(view, /label="Tracked conversions"/);
assert.match(view, /Estimated commission/);
assert.match(view, /Unverified, not a payout/);
assert.match(view, /Awaiting settlement/);
assert.match(view, /Math\.max\(0, Number\(campaign\.spend \|\| 0\) - Number\(campaign\.spend_transferred \|\| 0\)\)/);

// Original affiliate-specific workflows preserved.
assert.match(page, /\/api\/affiliate\/live-campaigns/);
assert.match(page, /from\("live_ads"\)/);
assert.match(page, /from\("ad_ideas"\)/);
assert.match(page, /setOffer/);
assert.match(page, /campaign\?\.tracking_link/);
assert.match(view, /disabled=\{!trackingUrl \|\| inactive \|\| !affiliateReady\}/);
assert.match(view, /onCopy/);
assert.match(view, /Campaign creative/);
assert.match(view, /CreativePreview/);
assert.match(view, /onEmailModalChange\(true\)/);
assert.match(page, /window\.confirm\("Permanently delete this organic campaign/);
assert.match(view, /onDeleteOrganic/);
assert.match(view, /\/affiliate\/dashboard\/promote\//);
console.log("affiliate paid/organic campaign detail UI regression checks passed");
