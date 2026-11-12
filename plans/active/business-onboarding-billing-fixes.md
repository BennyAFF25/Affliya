# Business onboarding and billing fixes

Status: Local implementation and offline validation complete, with the baseline failures and owner decisions below. Retained at the explicitly requested active-plan path. No DB/network connections, commits, pushes, deployment, production operations or protected-file edits.

## Intent, context and continuation

Continue the existing five-fix worktree, not a replacement implementation. Read AGENTS.md, VISION, PRODUCT_PRINCIPLES, MONEY_FLOW, TRACKING first; then PRODUCT, BUSINESS_RULES, ARCHITECTURE, DATABASE, UI_DESIGN_SYSTEM, META_ADS and plans/README. Local branch and main both point to d717b6c; upstream was not fetched because network is prohibited. The canonical mobile overview and styles inform the existing UI; this continuation adds an existing-button-style recovery action, not a new visual system.

Founder outcome: accurate business Connect country, reliable organic approval without premature card setup, useful safe card-decline diagnostics, 500-character organic captions, and a paid Meta-request prerequisite. A–E additionally require recovery artifacts, downstream country/currency review and real tests. These preserve business approval authority and attribution integrity while deferring billing until settlement. Affiliate payout expansion remains an owner decision, outside scope.

## Original five fixes retained

1. `utils/countries.ts` supplies ISO-2 countries/legacy-name normalization. New business Connect accounts require a country; stored accounts are retrieved, never recreated automatically. Billing profile/UI expose missing country. Corrected a continuation finding: an explicitly selected new-account country now updates a stale nonempty profile country too. A stored legacy country is preserved when no explicit selection is sent. Affiliate ad targeting uses the full existing country list; affiliate payout country is untouched.
2. Organic business approval is server-owned and card-independent. Stable campaign identity, linking, validation and recovery are described below.
3. Both existing card forms map safe human decline messages. Authenticated `setup-intent-failure` verifies business/customer ownership before auditing. Signed `setup_intent.setup_failed` webhook audits safe codes/IDs, never arbitrary bank/browser messages; audit failure returns 500 for Stripe retry. Verify event subscription before deployment.
4. Shared `organicCaption.ts` enforces 500 characters in reviewed approval, authenticated organic submission, preapproved organic and partner onboarding writers; browser submissions use the authenticated route.
5. Paid proposals require the affiliate/offer's `paid_promotion_meta_requested` event in UI and server. Already-connected businesses record request evidence without a redundant setup email; this does not grant Meta access or bypass launch review. Organic is unaffected.

## A. Approval identity, tracking and repair

Founder-supplied production/staging evidence: `organic_posts.campaign_id DEFAULT gen_random_uuid()` creates non-null unrelated IDs; 18 approved posts had no matching runtime ID. No database connection was made to repeat that evidence. The default remains unchanged; no migration is needed for this fix.

`utils/organicCampaignApproval.ts` is shared by the authenticated business route and operator script. It verifies saved post/offer ownership and affiliate context, type='organic', actual runtime existence at post.campaign_id or post.id, caption, tracking readiness and participation. A non-null orphan pointer is not success. It creates stable id=post.id and verifies all context on a 23505 retry. Linking compares the prior status AND prior campaign_id (null or non-null), plus offer/business/affiliate, rather than requiring null. Approved orphan posts are repairable. Rejected/other states cannot be approved through this helper.

On link failure, keep the stable campaign and prior post state for retry. The previous deletion compensation was unsafe: a concurrent request could have linked the campaign after the failing request's read. No row is deleted on ambiguous failure. This is a recoverable multi-query operation, not a transaction; interruption/concurrent reject remains a limitation to reconcile. The SQL alternative is transactional and locks both tables.

`post-ideas` resolves actual matching runtime rows and shows approved orphans in review with **Finish setup** in list and detail. It retries the same endpoint. A campaign-read failure does not guess that setup succeeded. `organicCampaignIdentity.ts` keeps pure identity matching separate from server-only approval dependencies.

Tracking links come from `utils/tracking/buildTrackingUrl.ts:3`, currently `https://www.nettmark.com/go/{runtimeId}` (TRACKING.md's older email-suffixed description is stale). Approval returns the canonical link. Existing campaign detail (`app/affiliate/dashboard/manage-campaigns/[campaignId]/page.tsx:617`) already constructs this URL from the live campaign ID. `utils/affiliate/proposalDetails.ts` now derives the link from a verified runtime even when both stored post link fields are null; no profile-ID or stored-link prerequisite. Redirect resolves live_campaigns and owned affiliate, checks participation, then records click and emits nm_camp/nm_aff. Merchant tracking retains these; strict billable identity resolves runtime rows.

Grep of all organic_posts callers: the only other campaign_id reader is nonbillable compatibility fallback at `app/api/track-event/route.ts:364`; writing the real runtime ID improves it. Affiliate proposal details now reads the pointer explicitly. Other organic readers select submission identity/status/creative fields, not a different campaign_id meaning. Preapproved/onboarding writers historically create separate runtime rows without linking the post; the backfill refuses to duplicate an existing offer/affiliate pair. Such historical mappings need manual review; this pass does not infer which of multiple creatives belongs to which legacy runtime.

## B. Operator recovery artifacts and expectations

- `scripts/backfill-stuck-organic-campaigns.ts`: read-only dry-run by default; explicit comma-separated `--post-ids` required; `--apply` writes; `--include-older` unlocks older candidates only. Allowlist and UUID validation prevent accidental broad repair. Uses SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY, disables session persistence, prints safe per-post plans/blockers, canonical link, commission status and whether a commission customer exists (card not verified). Same approval helper as route. Existing mismatching pair, missing/wrong-state post or failed readiness blocks. Replays use stable IDs. No script invocation against an actual database occurred.
- `ops/backfill/20261112_stuck_organic_campaigns.sql`: OWNER-RUN ONLY, explicit primary IDs, commented older opt-in; transaction/table locks, private timestamp-named backup populated with SELECT of prior campaign_id/status and created-row provenance, matching validation/readiness, stable inserts/links. Reruns skip applied backup entries. No post tracking fields are invented.
- `ops/backfill/20261112_stuck_organic_campaigns.undo.sql`: OWNER-RUN ONLY, restores prior state, deletes only rows proven created by this repair at id=post.id. Refuses changed posts, tracking events, clicks or other linked posts; keeps backup. Unknown deployed FK/trigger/schema differences must be reviewed before execution. SQL was statically reviewed, not executed/parsed against PostgreSQL. The SQL undo applies only to the SQL repair, which populates its backup; it is not an automatic undo for TypeScript --apply runs.

Expected dry-run from supplied evidence (not live results):

| Post | Expected creation / blockers |
| --- | --- |
| 259ffa4c… Nectar Petite, offer 29bbac72…, business b625311c… | USD does not block organic. NULL site_host requires one of the readiness alternatives below; otherwise OFFER_TRACKING_NOT_READY. Commission customer reportedly exists; this alone does not prove a card. |
| 8d78e331… MTS / Weather Ops, offer b2509b35…, business d488c60e… | Custom/Other passes current tracking heuristic. Create/link if participation approved, ownership/caption valid and no existing pair. Customer/card state remains unverified. |
| 3e025ae5… Raizora, offer bc7fdf0c…, business 943abbd7… | Custom/Other passes tracking heuristic. Missing stripe_customer_id does not block organic or liability recording; commission settlement additionally needs a customer/card. |
| da48433a… Evaheld (AUD, Sep 3) | Older candidate only, --include-older required; all readiness/ownership/participation/existing-pair checks still apply. AUD liabilities can reach settlement when eligible. |
| 918e9a34… Complete Guide To Trading (USD, Shopify, Sep 22) | Older candidate only; Shopify name is not runtime tracking proof; USD liabilities blocked at settlement. |
| 15cbc324… PolyAlertHub (USD, Sep 28) | Older candidate only; readiness/customer/participation unknown; USD liabilities blocked at settlement. |

(c) Exact tracking readiness (`utils/approvals/enforcement.ts:61`): any truthy site_host OR meta_pixel_id succeeds. Otherwise offer-specific tracking_connected progress, business-wide progress (offer_id NULL), or a prior test_pixel event succeeds. Thus this is a mixed host/pixel/progress/telemetry heuristic, not telemetry-only. Nectar is not definitely blocked from NULL host alone; missing alternatives means blocked. Do not fabricate a site_host to bypass it: install/test tracking and record legitimate readiness. Custom/Other is sufficient in current code but not evidence that purchases are measured.

(d) All three USD offers can create organic campaigns; neither currency_registry nor PAID_LAUNCH_CURRENCIES gates this helper. `utils/currency/registry.ts:1` describes a preparatory mirror; its imports in currency/money and wallet/balancesByCurrency are representation/offline diagnostics, not capability enablement in this flow. USD/GBP money capabilities are false there but not the operative approval/commission guard. `process-conversion:38` records offer currency, `:39` chooses blocked_currency for non-AUD, `:119` persists the liability. Conversion ingestion/attribution and eligible commission calculation can succeed with USD, without a saved business customer. `run-payout:303` blocks before payment/transfer for non-AUD: the brand is not charged and affiliate is not paid. There is no commission FX conversion path to unblock these posts. Do not confuse this with paid launch FX support.

## C. Business-country downstream trace and owner decisions

- New country flows from dashboard to `stripe/create-account:113` to Stripe. No default_currency override or country-based offer rewrite is introduced. Existing accounts always reuse the stored ID; changing profile country does not change an existing Stripe account's country. Account completion checks at `stripe/check-account:36` use submitted details/current requirements, not AU country. This branch's existing v1 Express integration/API version is preserved; no SDK/API migration was authorized.
- Offer currency is independent and authoritative (`utils/currency/proposalCurrency.ts:2`). Runtime IDs determine offer/affiliate attribution; neither business Connect country nor default currency participates. `track-event:266,287,525` extracts payload amount/currency and resolves runtime before writing campaign_tracking_events. `process-conversion:361,493` uses offer settings and eligible amount to compute percentage commission; recurring paths persist schedules too. No business Connect lookup is required.
- This branch has generic tracker and Shopify Customer Events installation snippet in SetupTrackingContent and checkout-payload handling in track-event. No standalone Shopify pixel-events route or WooCommerce webhook conversion handler is present (local file/content search). Other branches were not queried. Those integration-specific signatures, order deduplication and currency handling cannot be certified here.
- Commission settlement (`run-payout:303,350,378,427,454,545`) reads commission stripe_customer_id (not subscription customer or business Connect), saved card, affiliate transfer readiness and 14-day hold. It charges AUD principal plus fee and separately transfers AUD principal to affiliate Connect. No destination charge, on_behalf_of, application_fee or transfer_data coupling to business Connect exists in searched runtime code. The card issuer may convert the AUD charge; code does not promise issuer rate/fees. USD/GBP offers are blocked before charge; there is no ~4% commission buffer. Failures preserve liabilities; Stripe operation idempotency keys prevent repeating successful charge on transfer retry.
- Affiliate spend wallet stays AUD: topup session:52, wallet canonical ledger/balance and launch holds. Non-AUD paid campaign budgeting uses verified matching offer/Meta-account currency, fresh FX to AUD and reserveLaunchHold:48's default 400bps buffer. Settlement converts actual spend with settlementFx:15 (no buffer added to settled principal), records AUD deductions plus original FX evidence, and batches reimbursement to BUSINESS Connect (`adSpend/settlements:200,639,747`). Business is externally billed by Meta; Nettmark reimburses it from affiliate funding. Wallet topups and commission earnings are separate ledgers.
- Business Connect's actual money purpose is receiving paid-ad spend reimbursements. Batches hardcode currency aud, check transfer capability/payouts_enabled, persist failures/blocked/pending-funds state, and do not inspect destination country/default_currency. No code-side AU country rejection was found. HOWEVER this cannot prove Stripe platform/destination cross-border and settlement-currency eligibility. A US/UK business could pass local readiness and still have an AUD transfer rejected by Stripe. Rows remain retryable; no automatic FX/business-currency transfer fallback is implemented. Guaranteeing every non-AU reimbursement requires owner verification of platform country/capabilities/Stripe agreement and possibly a separately approved money-flow design. This is a material remaining risk, not fixed by selecting country.
- Genuine business-side inconsistency fixed: selecting US for a new account while profile country was AU now persists US as well; mocked AU/US tests exercise correct creation and reuse. No affiliate file, currency registry, protected build-info or payout-country logic changed.

Nectar existing AU-defaulted account, stripe_onboarding_complete=false: leaving it keeps AU onboarding/requirements and the same ID; adding a country does not migrate it. Organic and commission-customer/card flow are independent of that account. Paid reimbursement still needs a usable receiving Connect account. Recreating requires an explicit owner-run operation: verify true legal country and existing pending balances/transfers/requirements, create the correct-country account via the established integration, record old/new IDs privately, replace only the intended business_profiles.stripe_account_id with an old-ID compare-and-set, reset onboarding_complete=false, complete new onboarding, verify receiving capability/cross-border eligibility, and reconcile queued/in-flight settlements before retiring the old account. Do not bulk-reassign historical transfer IDs, customer IDs, subscriptions or affiliate accounts. No recreation command/path was added or run; owner decision remains pending.

Other unchanged risks: conversion processor uses offer currency for liabilities without proving event-currency equality/FX; browser payloads are not independently verified order revenue. Generic order deduplication and monetary reconciliation limitations in TRACKING/MONEY_FLOW remain. These were not silently changed as part of business-country onboarding.

## D. US affiliate → UK brand / GBP offer, plain-language code evidence

1. The affiliate funds advertising, while Meta bills the brand's ad account. Wallet checkout charges AUD (`app/api/stripe/create-topup-session/route.ts:52,78,116`); card billing currency is not selected from US residence. Any card-issuer USD→AUD conversion/fees are external. Topup is currently gated on completed affiliate Connect. The AU-only new affiliate Connect country at `app/api/stripe/affiliates/create-account/route.ts:74` can prevent a genuine US affiliate completing valid onboarding; this is the earliest practical break, even before funding.
2. Assuming an already usable affiliate account/wallet, a GBP offer needs a GBP Meta ad account (`utils/currency/proposalCurrency.ts:11`) and GBP enabled by PAID_LAUNCH_CURRENCIES (`paidCurrencyGuard.ts:7`, default AUD,USD,GBP,CAD; actual environment unknown). FX quote freshness and bounds are checked (`utils/fx/rates.ts:26`); AUD hold covers GBP budget converted to AUD plus default 4% reserve (`utils/wallet/launchHolds.ts:48`). The reserve is a funding cushion, not a separate brand commission charge. Spend is deducted/reimbursed in AUD at settlement FX, with persisted original GBP evidence (`utils/adSpend/settlements.ts:429,471,747`). UK-business AUD receiving eligibility remains the external risk above.
3. A valid tracked purchase can produce a GBP commission liability: runtime resolves owner/affiliate (`utils/tracking/campaignIdentity.ts:41`), eligible amount × offer commission is computed (`app/api/process-conversion/route.ts:493`), GBP is recorded and status becomes blocked_currency (`:38,119`). The business is **not charged GBP or converted AUD commission today**. `app/api/run-payout/route.ts:303` rejects settlement before any charge/transfer, regardless of the brand being UK or its card currency. Thus no commission FX buffer applies.
4. The affiliate's commission is recorded as owed but cannot be transferred by the present GBP path; AU-only affiliate Connect is a second independent limitation. For an AUD offer with a ready affiliate account, settlement instead charges the brand card AUD plus the platform fee and transfers AUD after maturity (`run-payout:454,545`). Country-aware BUSINESS Connect alone cannot resolve either affiliate onboarding or non-AUD commission containment. Both require separate owner decisions.

## E. Validation and review evidence

Real files: `scripts/business-onboarding-billing-fixes.test.ts` and `scripts/organic-campaign-backfill.test.ts`, wired as `test:business-onboarding-billing`. All new test DB/Stripe operations are mocked; fetch throws, and suite execution additionally preloaded a net.Socket.connect/fetch deny hook. No external connection was opened.

Passing coverage: correct AU/US creation, explicit/stored-country consistency, existing-account reuse, auth/context rejection, random non-null campaign default, stable UUID duplicate/retry, approved orphan repair, failed-link recovery, canonical link with NULL stored links, every tracking readiness alternative, participation rejection, dry-run no writes, explicit-ID/older guards, legacy pair protection, caption validation, Meta request guard, safe card audit/customer ownership, signed webhook rejection/retry. Actual runtime resolver → process-conversion → run-payout handlers are exercised for AU and US business profiles with AUD/USD/GBP offers: identical AUD behavior, percentage liability, holds, missing customer, charge-success/transfer-failure recovery without double charge, idempotent replay, blocked currencies without money movement. This is mocked logic evidence, not Stripe country/capability certification.

Related suites: business-subscription-gate and critical-route-auth PASS. Currency seg2,3,4,7,8,9,10 and seg1b PASS. Five failures reproduced unchanged against isolated local HEAD (d717b6c):
- seg1 containment: stale AUD-only message vs current missing-account-currency message.
- seg1c: expects a USD warning under old containment mode (now absent with enabled-currency defaults).
- seg5 and seg6: source-extraction tests cannot find the expected refund helper.
- seg11: obsolete source regex expects inline has_drift filter.
No currency implementation/test was changed to conceal these failures.

`tsc --noEmit --incremental false` PASS (zero errors, no build-info writes). ESLint touched TS/TSX: 278 existing errors vs HEAD 282, zero new error signatures; all new files pass. Known baseline errors include React scope/configuration and explicit-any. `git diff --check` PASS. Reviewed narrow diffs/dead code; superseded route implementation removed in favor of the helper. Pure identity code avoids importing server dependencies into the client. React skill checklist reviewed for the existing multi-component diff (hooks, types, labels, current styles); no new UI pattern introduced.

Build skipped under explicit network prohibition: no dummy/offline build pattern found; `.github/workflows/billing-recovery.yml:37` documents production-env dependency, and `app/api/stripe/webhook/route.ts:38` makes an import-time Stripe accounts.retrieve call. No dependency install, browser session, provider/DB check or SQL execution occurred.

Database/configuration: no executed changes or schema migration/default change. Operator SQL creates a private backup schema/table only when explicitly run later. package.json adds the local regression command. Owner follow-up: non-AU business transfer support and Nectar account recreation; affiliate payout expansion remains pending; verify Stripe failure-webhook subscription; perform reviewed live dry runs/schema validation before any backfill/deployment.

## Complete changed-file inventory (including prior-pass work)

- `app/affiliate/dashboard/promote/[offerId]/page.tsx`
- `app/affiliate/dashboard/promote/components/AdFormFields.tsx`
- `app/affiliate/dashboard/promote/components/OrganicSubmissionForm.tsx`
- `app/api/affiliate/ad-ideas/create/route.ts`
- `app/api/affiliate/offers/[offerId]/paid-promotion-request/route.ts`
- `app/api/affiliate/offers/[offerId]/ready-organic-promotion/route.ts`
- `app/api/affiliate/organic-posts/create/route.ts`
- `app/api/business/organic-campaigns/route.ts`
- `app/api/onboarding/ready-first-promotion/route.ts`
- `app/api/stripe/business-billing-profile/route.ts`
- `app/api/stripe/create-account/route.ts`
- `app/api/stripe/setup-intent-failure/route.ts`
- `app/api/stripe/webhook/route.ts`
- `app/business/my-business/ad-ideas/[id]/page.tsx`
- `app/business/my-business/page.tsx`
- `app/business/my-business/post-ideas/page.tsx`
- `ops/backfill/20261112_stuck_organic_campaigns.sql`
- `ops/backfill/20261112_stuck_organic_campaigns.undo.sql`
- `package.json`
- `plans/active/business-onboarding-billing-fixes.md`
- `scripts/backfill-stuck-organic-campaigns.ts`
- `scripts/business-onboarding-billing-fixes.test.ts`
- `scripts/organic-campaign-backfill.test.ts`
- `utils/affiliate/proposalDetails.ts`
- `utils/businessCardSetup.ts`
- `utils/businessCardSetupAudit.ts`
- `utils/countries.ts`
- `utils/organicCampaignApproval.ts`
- `utils/organicCampaignIdentity.ts`
- `utils/organicCaption.ts`

## Reviewer (Cody) follow-ups, 2026-11-12
- Legacy approved posts whose campaign was created under a random id (pre-stable-id flow) are now recognised by offer/business/affiliate pair (`findLegacyPairCampaign`), so "Finish setup" never creates a duplicate campaign; pending posts still get their own stable campaign. Test added.
- Paid Meta-access request is required only when the offer lacks a connected Meta Page + ad account (client and `ad-ideas/create`), so already-connected offers are not blocked. Test added.
- Backfill SQL executed on STAGING (qcwmrovdadlhgzweulee) against fake fixtures mirroring the 3 post ids: Nectar fixture with no tracking evidence aborted the whole transaction ("Tracking not ready"); MTS + Raizora run created/linked both campaigns; re-run was a no-op; undo restored prior state. Fixtures removed. Artifacts: /workspace/db-backups/20261112-bizfixes-backfill-staging/.
- Production read-only check: all 3 posts pass readiness (Nectar via tracking_connected progress + test_pixel), affiliate approved, caption <500, no stable-id conflict, no existing pair campaign.
