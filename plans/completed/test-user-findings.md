# Test-user repairs
Status: Completed local repairs and validation; human production verification remains as listed below.
Problem: twelve reported wizard, onboarding, tracking, webhook and wallet defects.
Product intent: preserve approval-before-launch, affiliate-funded economics and private identity; make existing flows truthful and responsive. Founder explicitly requests these repairs. No pricing change, production operations, commits, or Meta writes.
Approach: inspect each current flow, repair verified defects in priority order, add additive SQL only where required, then run typecheck/lint/build and relevant regression checks.
Affected systems: proposal UI, onboarding/auth, targeting reads, marketing embeds, webhook outbox, tracking and spend reconciliation.
Risks: deployed schema/account currency and external widget licensing unknown; do not infer live state. Money and attribution changes require end-to-end evidence.
Validation: local checks and source audit; real-user and production checks remain human tasks.

## Implemented findings and evidence
1. Wizard budget, increments, bid cap and review use the offer campaign currency; existing proposal/launch routes reject mismatches against connected Meta currency. Wallet remains explicitly AUD; non-AUD funding is marked for verification rather than claimed funded.
2. Advantage Audience remains off by default, is switched off when maximum age falls below 65, and cannot be re-enabled until compatible; inline note explains why.
3. Added client `/logout` using existing Supabase signOut with retry; sign-out links on plan choice, both onboarding journeys and business/affiliate access gates.
4. Removed blocking creator-referral attribution from signup and client business-profile round trip from plan choice. Retained server ownership verification and clearer loading progress. Real latency not measured.
5. New business signup/plan/offer show 1/2/3 of 3; affiliate signup retains its own two-step journey.
6. Shared Growth price formatter produces A$49 and affected modal/settings/Meta setup copy now agrees. Other currencies retain existing code formatting; amounts and Stripe prices unchanged.
7. Authenticated affiliate targeting lookup can use server-only META_TARGETING_SEARCH_TOKEN before looking up a brand connection; no Meta write added or executed. Credentials need read permission for adinterest search; plain app-ID/app-secret token suitability is unverified.
8. End date selection and +7 days default to 23:59 local time. Minute selector supports 59 without rounding display down; Start/End labels and local-time context are visible.
9. Chatbase identity is now session-gated React logic. Storylane watermark unchanged: external iframe branding requires vendor/account settings; no safe local removal verified.
10. New unapplied migration replaces business-profile capture with normalized real-change checks, excludes nested signup-name initialization, preserves signed_up INSERT/dedupe behavior and stamps queue creation using clock_timestamp. Delivery occurred_at already reads immutable outbox created_at, not delivery time. Historical rows and delayed backlog unchanged; deployed trigger/delivery state unknown.
11. Tracking builder emits campaign-only refs; shop/offer refs use UUID, ingestion maps UUID to the existing internal email linkage. Legacy email refs (including hyphenated emails) remain accepted; resolved runtime ownership supplies attribution. Known bots/prefetch skip click/shop increments. Redirect no longer writes live_ads. Organic live-campaign API accepts stable UUID or legacy email ownership; paid campaigns still use existing separate live_ads loader. Removed nonexistent offers.name probe. Legacy inbox migration exists at supabase/migrations/20261009010000_affiliate_inbox_messages.sql; chat migration exists at 20261012134500_inbox_chat_messages.sql. No live schema query performed. Access verification has an 8-second timeout and exit links, without granting unverified access.
12. Pause checks now handle exhausted funding with zero unpaid spend, include the same reserved starter subsidy as settlement, and re-read post-settlement funding. Cron permits the existing ledger helper to reimburse the funded portion of underfunded spend. No sync route executed.

## Product alignment and documentation conflict
Changes retain existing approvals, pricing, commercial ownership, ledgers and seven-day attribution. docs/PRODUCT.md describes offer-first business signup; current create-account and plans/active/growth-trial-before-offer-20261012.md establish the explicitly directed plan-first journey. We follow current code and founder request, preserving older cohorts. No visual redesign: existing cyan, dark surfaces and controls are extended.

## Review and outstanding verification
- Apply new 20261014090000_webhook_event_wall_clock.sql only after review and staging tests. It replaces functions/one capture trigger, with no data deletion/backfill, grants expansion or history transformation; minimum PostgreSQL 14 for CREATE OR REPLACE TRIGGER. Restore previous function/trigger definition to roll back behavior; timestamps already captured remain intact.
- Verify deployed signup provisioning/outbox triggers and inbox tables before assuming migration files are applied. Existing inbox and signup migrations contain their own historic operations; do not blindly replay all migrations.
- Set META_TARGETING_SEARCH_TOKEN through an authorized operator, server-only and with targeting-read permissions; confirm success with unconnected-brand offer. No env/config changes made here.
- Storylane branding must be reviewed in the Storylane account; no license/settings evidence available.
- AUD wallet/settlement amounts versus GBP/USD Meta spend: no verified FX policy. Proposal budget is explicit, but cross-currency reimbursement is unresolved. Do not validate with actual ad launches/spend.
- utils/adSpend/settlements.ts claims spend_transferred, then applies subsidy/deduction/settlement rows in separate operations. A crash or settlement-row failure after deduction can leave reimbursement missing behind an advanced watermark. This requires transactional/reconciliation design and schema verification; not safely repaired by rolling back the watermark after a charge. Independent transfer-batch cron provides retries only for rows that exist.
- Bot classification is heuristic and does not identify bots spoofing real browser user agents. Historic inflated click rows and legacy issued links are preserved.
- No authenticated browser E2E, live DB, Meta, Stripe, webhook delivery or protected campaign operations performed.
- Workspace advanced externally from initial 9c8dd41 to WIP 5018b20 during validation; no commit/push commands were issued by this agent. Subsequent correction/test/plan edits are left for founder commit.

## Validation
- npm ci failed because no package-lock.json exists; dependencies installed using checked-in Yarn lock with frozen-lockfile. No manifest/lock changes.
- New currency/privacy/ref parsing/pause/funding tests pass; reserved subsidy and post-deduction exhaustion exercised with local mocks.
- business-onboarding-funnel, meta-campaign-configuration, inbox-bot-report, auto-meta-spend-refresh and affiliate-assistant-webhook tests pass.
- signup-profile-provisioning and tracking-metrics source tests fail on stale assertions; same failures reproduced in isolated original HEAD (9c8dd41).
- Full typecheck and lint run; compared with isolated original HEAD using same dependencies/generated types. Pre-existing sample Supabase typing, App Router signatures, JSX lint configuration and other repo errors remain. Final counts recorded after final checks below.
- Build compiles application successfully; page-data collection fails for existing service clients because Supabase URL/key configuration is absent. No placeholder/live credentials supplied and no external runtime route invoked.
- New-file lint and git diff --check pass. SQL reviewed statically only; no local PostgreSQL available and no migration applied.

Final checks: typecheck reports 90 existing errors versus 93 on original HEAD, with zero new diagnostics. Lint reports 3,525 existing diagnostics versus 4,175 on original HEAD, with zero new diagnostics. Final build compiled successfully and failed during page collection for missing Supabase configuration.

## Files and purpose
- `app/affiliate/dashboard/manage-campaigns/[campaignId]/page.tsx` — campaign data/schema lookup or bounded role verification.
- `app/affiliate/dashboard/manage-campaigns/page.tsx` — campaign data/schema lookup or bounded role verification.
- `app/affiliate/dashboard/promote/[offerId]/page.tsx` — proposal currency, audience, schedule or interest search repair.
- `app/affiliate/dashboard/promote/components/AdCampaignWizard.tsx` — proposal currency, audience, schedule or interest search repair.
- `app/affiliate/dashboard/promote/components/AdFormFields.tsx` — proposal currency, audience, schedule or interest search repair.
- `app/affiliate/layout.tsx` — campaign data/schema lookup or bounded role verification.
- `app/api/affiliate/ad-ideas/create/route.ts` — proposal currency, audience, schedule or interest search repair.
- `app/api/affiliate/live-campaigns/route.ts` — campaign data/schema lookup or bounded role verification.
- `app/api/business-subscription/trial-eligibility/route.ts` — signup/plan/onboarding progress, sign-out or consistent price display.
- `app/api/meta/ad-insights/route.ts` — consistent funding, settlement and pause guardrails.
- `app/api/meta/interests/route.ts` — proposal currency, audience, schedule or interest search repair.
- `app/api/meta/sync-active-ads/route.ts` — consistent funding, settlement and pause guardrails.
- `app/api/track-event/route.ts` — private tracking identifiers and bot-safe redirects.
- `app/business/choose-plan/page.tsx` — signup/plan/onboarding progress, sign-out or consistent price display.
- `app/business/layout.tsx` — signup/plan/onboarding progress, sign-out or consistent price display.
- `app/business/my-business/GrowthMetaSetupPrompt.tsx` — signup/plan/onboarding progress, sign-out or consistent price display.
- `app/business/settings/page.tsx` — signup/plan/onboarding progress, sign-out or consistent price display.
- `app/create-account/page.tsx` — signup/plan/onboarding progress, sign-out or consistent price display.
- `app/go/[ref]/route.ts` — private tracking identifiers and bot-safe redirects.
- `app/layout.tsx` — session-gated Chatbase identity.
- `app/logout/page.tsx` — signup/plan/onboarding progress, sign-out or consistent price display.
- `app/onboarding/for-business/page.tsx` — signup/plan/onboarding progress, sign-out or consistent price display.
- `app/onboarding/for-partners/page.tsx` — signup/plan/onboarding progress, sign-out or consistent price display.
- `app/shop/[handle]/page.tsx` — private tracking identifiers and bot-safe redirects.
- `components/ChatbaseIdentity.tsx` — session-gated Chatbase identity.
- `components/business/BusinessSubscriptionActivationModal.tsx` — signup/plan/onboarding progress, sign-out or consistent price display.
- `components/business/BusinessTrialFirstContinuation.tsx` — signup/plan/onboarding progress, sign-out or consistent price display.
- `scripts/business-onboarding-funnel.test.ts` — currency, targeting/funding, privacy regression validation.
- `scripts/test-user-repairs.test.ts` — currency, targeting/funding, privacy regression validation.
- `supabase/migrations/20261014090000_webhook_event_wall_clock.sql` — unapplied webhook timing/change capture migration.
- `utils/adSpend/pauseGuardrail.ts` — consistent funding, settlement and pause guardrails.
- `utils/adSpend/settlements.ts` — consistent funding, settlement and pause guardrails.
- `utils/businessOnboardingFunnel.ts` — signup/plan/onboarding progress, sign-out or consistent price display.
- `utils/tracking/buildTrackingUrl.ts` — private tracking identifiers and bot-safe redirects.
- `utils/tracking/parseTrackingRef.ts` — private tracking identifiers and bot-safe redirects.
