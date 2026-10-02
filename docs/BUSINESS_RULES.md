# Nettmark business rules

> Repository evidence as of 2026-10-02. Static inspection only: live database schema, deployed configuration, external account state, and production behavior were not verified. Paths below are relative to the repository root. Historical LR reports may describe older behavior.

## Rules enforced by current paths

| Rule | Evidence |
|---|---|
| Participation can be open, approval-required, or private | `utils/approvals/enforcement.ts`, `/api/affiliate/offers/[offerId]/start`, migration `20260901093000_offer_participation_mode.sql`. Unknown modes normalize to open. Private mode blocks new marketplace participation; existing approved participation remains usable. |
| Participation approval is distinct from creative approval | `assertAffiliateOfferApproved` accepts approved/active/accepted request states; paid launch also requires an approved matching `ad_ideas` row through `assertAdIdeaLaunchApproved`. |
| Offers must be available to start/preapproved-promote | Start and ready-organic routes accept active/approved/live/published, with compatibility fallback if optional columns are absent. |
| Brand content must match ownership and usage | Preapproved organic endpoints check business and offer association, active/unarchived state, organic permission, and organic preapproval. Business-wide assets can have no offer ID. |
| Paid launch requires readiness | Business launch checks saved authoritative proposal, ownership, participation, tracking, card, entitlement, dates, Meta selections, and funding. Sales objectives require a selected pixel/dataset. |
| Subscription gate is paid-specific in latest SQL | `20260813090000_paid_ad_only_business_subscription_gate.sql` explicitly retains paid idea approval/live-ad insertion triggers and removes organic/request triggers. Application gate requires both `BUSINESS_SUBSCRIPTIONS_ENABLED` and `BUSINESS_SUBSCRIPTION_GATE_ENABLED`; SQL gate reads database settings separately. |
| Launch entitlement | `utils/businessEntitlements.ts`: grandfathered or active/trialing subscribers can launch when gate is enforced. Missing entitlement row fallback returns a free, subscription-required evaluation; inspect actual evaluation rather than relying on its permissive-sounding comment. |
| Commission billing readiness is separate | `utils/businessPaymentReadiness.ts` uses commission Stripe customer/card, explicitly excludes Growth/Business subscription customer as proof of readiness. |
| Tracked sale scope controls payout basis | Store-wide uses gross; specific-products uses eligible matched amounts via `utils/offers/conversionScope.ts`. |
| One-off versus recurring commissions | `process-conversion` computes percentage payout for one-off; recurring uses configured monthly amount and term, upfront total or monthly spread, first available after 14 days. Recurring instance state controls future settlement. |
| Commission and spend wallets are separate | Wallet availability is top-up/refund/deduction-derived; commissions create payout liabilities, then Connect transfers. |
| Paused redirect/business stop | `/go/[ref]` blocks paused campaign redirects; `control-ad` refuses resume after business termination. |

## Path differences that matter

Reviewed organic approval (`/api/business/organic-campaigns`) checks business ownership, participation, tracking, and commission card. The review UI marks the post approved before creating the live campaign; failure can leave an approved post without a campaign. Preapproved organic and first-party onboarding routes verify session/participation/content and create live campaigns without the same card/tracking checks. Do not document a universal activation guard until these paths are reconciled.

Launch readiness combines wallet, reserved business subsidy, and eligible uncommitted launch fund. Actual spend settlement currently visibly combines wallet and subsidy. Funding advertised by UI is not proof of settled reimbursement capacity.

Business onboarding stores rounded whole-unit `commission_value`; full create-offer rounds to two decimal places and has recurring settings. One-off payouts use commission percentage, but recurring uses stored monthly value. Verify rounding and defaults before changing prices or terms.

Currencies are selectable/stored in offers/events; `/api/run-payout` uses AUD. Cross-currency conversion policy is unknown. Creator subscription commissions are a separate ledger from merchant-sale affiliate payouts.

## Safe change checklist

Trace every applicable entrypoint, including direct browser writes, API handlers, SQL triggers, compatibility fallbacks, and webhook retries. Validate authorization, scope, amount units, idempotency, and partial failures. Local migration intent is not proof the rule is active in the deployed database.
