import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const business = readFileSync("app/business/manage-campaigns/page.tsx", "utf8");
const affiliate = readFileSync("app/affiliate/dashboard/manage-campaigns/page.tsx", "utf8");
const workspace = readFileSync("components/business/ManageCampaignsWorkspace.tsx", "utf8");
const portal = readFileSync("utils/affiliate/portalData.ts", "utf8");

assert.match(business, /<ManageCampaignsWorkspace/, "business continues using the shared table");
assert.match(affiliate, /<ManageCampaignsWorkspace\s+audience="affiliate"/, "affiliate uses exact same visual workspace");
assert.match(workspace, /audience === "affiliate"/, "role-driven navigation and visual differences");
assert.match(workspace, /xl:hidden/, "same mobile campaign cards");
assert.match(workspace, /xl:block/, "same desktop campaign table");
assert.match(workspace, /aria-label="Campaign type"/);
assert.match(workspace, /aria-label="Sort campaigns"/);
assert.match(workspace, /Search campaigns\.\.\./);
assert.match(workspace, /<MetaMark/, "Meta ads retain their logo");
assert.match(workspace, /#151718|#101415/, "canonical dark neutrals retained");
assert.match(workspace, /#00[Cc]2[Cc][Bb]/, "brand cyan retained");

// Affiliate routing and actions are different from business permissions.
assert.match(workspace, /\/affiliate\/dashboard\/manage-campaigns\//);
assert.match(workspace, /\/business\/manage-campaigns\//);
assert.match(workspace, /\/affiliate\/marketplace/);
assert.match(workspace, /\/affiliate\/dashboard/);
assert.match(workspace, /props\.audience !== "affiliate" \? \(/, "business-only Stop/Pause");
assert.match(workspace, /props\.onStopMeta\(campaign\.id\)/);
assert.match(workspace, /props\.onPauseOrganic\(campaign\.id/, "business organic pause retained");
assert.match(affiliate, /onSyncSpend=\{\(id\) => \{/);
assert.match(affiliate, /syncSpendForPaidMeta\(row\)/, "existing manual Meta Insights sync retained");
assert.doesNotMatch(affiliate, /onStopMeta=|onPauseOrganic=|\/api\/meta\/control-ad/, "affiliate list cannot issue business controls");

// Real client-owned campaign data, proposals, finance status, and auto-refresh.
assert.match(affiliate, /loadAffiliatePaidCampaigns\(supabase,\s*email\)/);
assert.match(affiliate, /\/api\/affiliate\/live-campaigns/);
assert.match(affiliate, /loadAffiliateSubmissions\(supabase,\s*email\)/);
assert.match(affiliate, /\/api\/affiliate\/pending-paid-proposals/);
assert.match(affiliate, /30_000/, "read-only stored spend poll preserved");
assert.match(affiliate, /pendingContent=\{/);
assert.match(affiliate, /PendingProposalRow/);
assert.match(affiliate, /funding_required|funded_waiting_for_business/);
assert.match(affiliate, /submittedRetryDone\.current/, "post-submit race retry remains");
assert.match(affiliate, /No wallet funds have been reserved/);
assert.match(affiliate, /Math\.max\(0, Number\(row\.spend \|\| 0\) - Number\(row\.spend_transferred \|\| 0\)\)/);
assert.match(portal, /"live_ads","id,offer_id,ad_idea_id,caption,status,billing_state,meta_ad_id,meta_campaign_id,spend,spend_transferred,clicks,conversions,tracking_link,created_at"/);
assert.doesNotMatch(affiliate, /function CampaignRow\(/, "old 2nd layout removed");
assert.doesNotMatch(affiliate, /<StatCard|<SectionHeader/, "no duplicate old UI");
console.log("affiliate/business shared campaign workspace regression checks passed");
