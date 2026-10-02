# Nettmark Meta ads

> Repository evidence as of 2026-10-02. Static inspection only: live database schema, deployed configuration, external account state, and production behavior were not verified. Paths below are relative to the repository root. Historical LR reports may describe older behavior.

## Connection and asset selection

Business UI: `app/business/my-business/connect-meta/page.tsx`. `/api/meta/start` builds OAuth permissions and an encoded business return path. `/api/meta/callback` exchanges the code, requires the Nettmark session email, fetches Meta name/ad accounts/pages, and upserts every account/page combination into `meta_connections`. It intentionally does not request Meta email; the comment identifies Nettmark's signed-in business email as the association.

`app/business/my-business/create-offer/page.tsx` and `/api/business/offers/[offerId]/meta-assets` associate offer-level page/account/pixel selections. Dataset discovery and verification use `/api/meta/get-datasets` and `/api/meta/verify-pixel`; helpers live in `utils/meta/`.

## Proposal → launch

1. `app/affiliate/dashboard/promote/[offerId]/page.tsx` and its form components collect creative, targeting, timing, and budget and persist an `ad_ideas` proposal. Brand content and paid-promotion-request routes offer additional entrypoints.
2. Business review uses `app/business/my-business/ad-ideas/page.tsx`; launch calls `/api/business/ad-ideas/launch`.
3. The handler authenticates the business, loads authoritative saved proposal fields, checks ownership/rejection/existing launch and partial Meta IDs, then verifies participation, entitlement, business commission card, tracking, timing, offer Meta assets, pixel for sales, and affiliate funding (`utils/paidCampaignLaunchReadiness.ts`).
4. It claims pending → approved before invoking the existing Meta handler. Failure restores pending; a partial Meta campaign ID is retained to prevent automatic duplicate creation.
5. `app/api/meta/callback/upload-video/route.ts` rechecks authenticated ownership/approval and readiness, reads the connection, creates a campaign, persists its Meta ID on the idea, creates an ad set, uploads image/video as needed, creates creative and ad, and inserts `live_ads` with Meta IDs and offer/affiliate/business linkage.
6. After insertion it builds a canonical runtime tracking link and updates local records. Success requires a local live-ad row, not merely a Meta campaign ID.

Meta budget fields are minor units; `budget_amount` is converted to major units for readiness. Legacy `daily_budget` handling differs between paths and needs care. DAILY versus LIFETIME budgets and schedule fields are passed to Meta. Inspect objective/optimization/pixel and targeting branches before modifying payloads.

## Operations and money

`/api/meta/ad-insights` and cron `/api/meta/sync-active-ads` read insights. Sync selects active/live local ads, updates metrics, checks funding, settles spend, and can pause campaigns. `vercel.json` schedules sync every five minutes with `CRON_SECRET` authorization. Nettmark settlement reimburses the business Connect account separately from Meta's own billing.

`/api/meta/control-ad` chooses ad, then ad set, then campaign as the control target. It updates Meta and local state, can trigger settlement, and prevents resuming business-terminated campaigns. The handler takes actor/action from the request; no explicit authenticated ownership check is visible there.

## Needs verification

- OAuth/creation hardcode Graph v19.0; control hardcodes v21.0. API versions are inconsistent; external validity was not checked.
- OAuth `state` is an encoded return path, with no visible random nonce/session binding.
- Stored token lifetime, refresh, revocation, pagination completeness, and production permissions/app review are not established.
- External objects are created before local bookkeeping completes. Partial-launch recovery must reconcile Meta IDs and database rows rather than blindly retry.
- The creative destination can precede canonical runtime link creation; confirm actual Meta creative attribution.
- Launch readiness counts launch funds; settlement counts wallet and reserved subsidy. Verify redemption before treating all quoted funding as usable.
