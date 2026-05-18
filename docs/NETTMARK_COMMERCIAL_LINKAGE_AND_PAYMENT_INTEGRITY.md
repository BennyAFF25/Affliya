# NETTMARK_COMMERCIAL_LINKAGE_AND_PAYMENT_INTEGRITY

## Scope and evidence

This is a read-only architecture audit based on static code inspection.

Limits of evidence:
- `psql: error: connection to server on socket "/tmp/.s.PGSQL.5432" failed: No such file or directory`
- `env | rg 'SUPABASE|DATABASE_URL|POSTGRES|PG'` returned no usable DB connection info
- `types/supabase.ts` is not the real schema; it only exposes `users`
- local `supabase/migrations` do not define the core commercial tables audited here

So this document treats route logic as the source of truth for actual linkage behavior.

Primary code evidence:
- `app/business/my-business/create-offer/page.tsx`
- `app/business/my-business/affiliate-requests/page.tsx`
- `app/business/my-business/ad-ideas/page.tsx`
- `app/business/my-business/post-ideas/page.tsx`
- `app/affiliate/dashboard/promote/[offerId]/page.tsx`
- `app/go/[ref]/route.ts`
- `app/api/track.gif/route.ts`
- `app/api/track-event/route.ts`
- `app/api/process-conversion/route.ts`
- `app/api/meta/callback/upload-video/route.ts`
- `app/api/meta/ad-insights/route.ts`
- `app/api/meta/sync-active-ads/route.ts`
- `app/api/ad-spend/settle/route.ts`
- `app/api/run-payout/route.ts`
- `app/api/stripe/webhook/route.ts`
- `app/business/payouts/page.tsx`
- `app/business/dashboard/page.tsx`
- `app/affiliate/wallet/page.tsx`
- `utils/supabase/getRefundableBalance.ts`

---

## Executive summary

The commercial chain exists, but it is not modeled as one tight canonical graph.

What is strong:
- `offers` is the practical anchor for commission rules, business ownership, Meta config, and redirect destination.
- `wallet_payouts.source_event_id` is the strongest payment-side linkage in the system.
- `live_ads.spend_transferred` plus optimistic update in `app/api/ad-spend/settle/route.ts` is a meaningful idempotency guard for ad spend settlement.
- `campaign_tracking_events` is the real event ledger in active code.

What is weak or fragmented:
- Ownership is often carried by `business_email` / `affiliate_email` instead of stable foreign keys.
- There are duplicate conversion->payout/payment paths: `app/api/track-event/route.ts`, `app/api/process-conversion/route.ts`, and legacy `app/api/track.gif/route.ts`.
- Approval state is not consistently enforced at the money-entry points.
- `campaign_id` semantics are inconsistent across organic, paid Meta, internal UUIDs, Meta IDs, and legacy `offer_id` fallbacks.
- `conversions` appears non-canonical or unused; active logic uses `campaign_tracking_events` instead.
- Refund and wallet balance logic is internally inconsistent (`wallet_deductions` vs `wallet_spends`; `wallets.balance` vs recomputed ledger balance).

Bottom line:
- The system can operate, but linkage integrity is not yet tight enough to treat all money flows as provably safe under scale.
- Before launch, the biggest risks are duplicate payout creation paths, approval bypass risk, email-based ownership, and inconsistent campaign identity.

---

## Canonical chain as implemented today

### Paid Meta path
1. `offers`
2. `affiliate_requests` approval
3. `ad_ideas` submitted with `status: "pending"`
4. business approves in `app/business/my-business/ad-ideas/page.tsx`
5. `sendToMeta()` -> `app/api/meta/callback/upload-video/route.ts`
6. Meta objects created; local `live_ads` row inserted
7. tracking link points to `/go/...` or is stored on `live_ads.tracking_link`
8. `app/go/[ref]/route.ts` writes `clicks`
9. storefront / pixel / beacon flows write `campaign_tracking_events`
10. conversion can create `wallet_payouts`
11. spend sync updates `live_ads.spend` / `clicks`
12. `app/api/ad-spend/settle/route.ts` writes `wallet_deductions` and optionally Stripe transfer to business
13. `app/api/run-payout/route.ts` charges business card and transfers to affiliate

### Organic path
1. `offers`
2. `affiliate_requests` approval is intended business rule, but not hard-enforced in submit path
3. affiliate submits `organic_posts` with `status: "pending"`
4. business approves in `app/business/my-business/post-ideas/page.tsx`
5. approval inserts `live_campaigns`
6. tracking resolves through `/go/...` and/or `campaign_tracking_events`
7. conversion processing uses `live_campaigns` + `offers` to create `wallet_payouts`

---

## Table-by-table integrity map

## `offers`

**Owns**
- commercial offer definition
- commission rule: `commission`
- payout behavior: `payout_mode`, `payout_interval`, `payout_cycles`
- business ownership via `business_email`
- destination / tracking hints: `website`, `site_host`
- Meta config: `meta_pixel_id`, `meta_page_id`, `meta_ad_account_id`

**Required IDs/fields actually relied on**
- `id`
- `business_email`
- `commission`
- `website`
- for Meta: `meta_page_id`, `meta_ad_account_id`, sometimes `meta_pixel_id`

**Must link upstream to**
- `business_profiles` logically by `business_email`
- `meta_connections` logically by `business_email`

**Downstream money movement depending on it**
- payout math in `app/api/track-event/route.ts` and `app/api/process-conversion/route.ts`
- ad spend settlement requires `live_ads.offer_id` pointing back here
- business payer resolution ultimately depends on `offer.business_email`

**Routes create/read/write**
- create/write: `app/business/my-business/create-offer/page.tsx`, `app/business/my-business/edit-offer/[offerId]/page.tsx`
- read: `app/affiliate/dashboard/promote/[offerId]/page.tsx`, `app/go/[ref]/route.ts`, `app/api/process-conversion/route.ts`, `app/api/track-event/route.ts`, `app/api/track.gif/route.ts`, `app/api/meta/callback/upload-video/route.ts`, dashboards

**Linkage strength**
- strong as source object
- weak in enforcement because much downstream ownership still falls back to email

**What breaks if broken**
- wrong business charged
- wrong commission percent
- ad launched against wrong Meta page/ad account
- tracking resolves to wrong destination or wrong offer
- conversion may fail with `offer_not_found`, `offer_not_resolved`, or `invalid_commission`

---

## `affiliate_requests`

**Owns**
- approval state for affiliate permission to promote an offer
- offer/business/affiliate relationship at approval time

**Required IDs/fields actually relied on**
- `id`
- `offer_id`
- `business_email`
- `affiliate_email`
- `status`

**Must link upstream to**
- `offers.id`
- business identity via `business_email`
- affiliate identity via `affiliate_email`

**Downstream money movement depending on it**
- intended prerequisite for `ad_ideas` and `organic_posts`
- not directly referenced by payout routes

**Routes create/read/write**
- read/update approval: `app/business/my-business/affiliate-requests/page.tsx`
- read in dashboards: `app/business/dashboard/page.tsx`
- checked by affiliate offer views / marketplace pages

**Linkage strength**
- weak to moderate
- approval exists, but money and live-campaign creation paths do not consistently re-check it
- email-based ownership

**What breaks if broken**
- unapproved affiliates can potentially submit creatives and enter money flows
- rejected affiliates may still be attributable if they possess tracking links
- stale approved rows can outlive offer changes

---

## `ad_ideas`

**Owns**
- paid creative submission before launch
- targeting/budget/creative settings
- `tracking_link`
- workflow state: `status`, `meta_status`

**Required IDs/fields actually relied on**
- `id`
- `offer_id`
- `affiliate_email`
- `business_email`
- `status`
- media fields (`file_url`, `thumbnail_url`)
- campaign config fields

**Must link upstream to**
- `offers.id`
- intended affiliate approval via `affiliate_requests`, but not enforced at insert time

**Downstream money movement depending on it**
- approval plus Meta upload creates `live_ads`
- `tracking_link` influences attribution and therefore payouts

**Routes create/read/write**
- create: `app/affiliate/dashboard/promote/[offerId]/page.tsx`
- read/update approve/reject: `app/business/my-business/ad-ideas/page.tsx`
- read during launch: `app/api/meta/callback/upload-video/route.ts`
- fallback lookup during tracking: `app/api/track-event/route.ts`, `app/go/[ref]/route.ts`

**Linkage strength**
- moderate
- tied to offer and emails, but not tightly tied to `affiliate_requests`
- duplicates campaign identity: `meta_campaign_id` in `ad_ideas`, then `live_ads` also stores Meta IDs

**What breaks if broken**
- ad can launch under wrong business Meta assets
- tracking link can point to wrong offer/affiliate
- paid campaign may be created without trustworthy approval ancestry

---

## `organic_posts`

**Owns**
- organic creative submission before approval
- platform/caption/media content
- approval status

**Required IDs/fields actually relied on**
- `id`
- `offer_id`
- `affiliate_email`
- `business_email`
- `status`
- `platform`
- media fields

**Must link upstream to**
- `offers.id`
- intended `affiliate_requests` approval, but submit path does not prove it

**Downstream money movement depending on it**
- approved row becomes `live_campaigns`
- later tracking and conversion payout depend on `offer_id`, `affiliate_email`, `business_email`

**Routes create/read/write**
- create: `app/affiliate/dashboard/promote/[offerId]/page.tsx`
- read/update approve/reject: `app/business/my-business/post-ideas/page.tsx`
- fallback lookup during tracking: `app/api/track-event/route.ts`

**Linkage strength**
- moderate for pending->approved separation
- weak for approval ancestry and stable campaign identity

**What breaks if broken**
- organic campaign can go live with wrong offer attribution
- approved and pending content can be confused if a later path ignores `status`
- conversions may attribute to an offer via hostname fallback instead of explicit lineage

---

## `live_ads`

**Owns**
- paid live runtime campaign record
- ad spend state: `spend`, `spend_transferred`
- Meta IDs: `meta_campaign_id`, `meta_ad_id`, `ad_set_id`, `creative_id`
- campaign classification: `campaign_type: "paid_meta"`

**Required IDs/fields actually relied on**
- `id`
- `offer_id`
- `affiliate_email`
- `business_email`
- `meta_ad_id`
- `spend`, `spend_transferred`
- `status`
- `campaign_id` (but this is problematic)

**Must link upstream to**
- `ad_ideas.id` via `ad_idea_id`
- `offers.id`
- business and affiliate profiles only by email
- Meta connection indirectly via business email

**Downstream money movement depending on it**
- `wallet_deductions` ad spend settlement uses `liveAdId`
- tracking fallbacks resolve `offer_id` through `live_ads`
- `campaign_tracking_events` may remap non-UUID Meta campaign IDs back to `live_ads.id`

**Routes create/read/write**
- create: `app/api/meta/callback/upload-video/route.ts`
- read/update spend: `app/api/meta/ad-insights/route.ts`, `app/api/meta/sync-active-ads/route.ts`
- settlement: `app/api/ad-spend/settle/route.ts`
- control/pausing: `app/api/meta/control-ad/route.ts`, `app/business/manage-campaigns/[campaignId]/page.tsx`
- fallback reads: `app/go/[ref]/route.ts`, `app/api/track-event/route.ts`, `app/api/track.gif/route.ts`

**Linkage strength**
- moderate
- strong on ad spend idempotency via `spend_transferred`
- weak on identity because `campaign_id` is set to inserted row id after creation, while Meta campaign/ad IDs also exist, and some tracking code still treats campaign IDs inconsistently
- email-based business/affiliate ownership

**What breaks if broken**
- spend can be assigned to wrong affiliate wallet or wrong business settlement
- tracking can bind to wrong campaign row
- duplicate settlement remains possible if ledger write fails after state mutation and rollback fails

---

## `live_campaigns`

**Owns**
- live organic campaign/runtime record
- organic campaign status

**Required IDs/fields actually relied on**
- `id`
- `offer_id`
- `affiliate_email`
- `business_email`
- `status`
- `platform`, `media_url`, `caption`

**Must link upstream to**
- approved `organic_posts`
- `offers.id`

**Downstream money movement depending on it**
- conversion payout resolution in `app/api/process-conversion/route.ts`
- tracking offer fallback in `app/api/track-event/route.ts` and `app/api/track.gif/route.ts`

**Routes create/read/write**
- create on approval: `app/business/my-business/post-ideas/page.tsx`
- read dashboards/manage pages: `app/business/dashboard/page.tsx`, `app/business/manage-campaigns/page.tsx`, `app/affiliate/dashboard/manage-campaigns/page.tsx`
- read in tracking: `app/go/[ref]/route.ts`, `app/api/process-conversion/route.ts`, `app/api/track-event/route.ts`, `app/api/track.gif/route.ts`

**Linkage strength**
- moderate
- better than `organic_posts` because it becomes the runtime anchor
- still email-based, and no explicit back-reference to source approval row was seen

**What breaks if broken**
- organic conversions cannot resolve business/affiliate/offer cleanly
- paid and organic campaign analytics diverge further

---

## `clicks`

**Owns**
- redirect click log from `/go/[ref]`

**Required IDs/fields actually relied on**
- `offer_id`
- `affiliate_id`
- `campaign_id`
- `ref_code`
- `campaign_type`

**Must link upstream to**
- parsed `/go/[ref]` token, then whichever source table resolved it: `live_campaigns`, `ad_ideas`, `live_ads`, or `offers`

**Downstream money movement depending on it**
- none directly in current audited payment code

**Routes create/read/write**
- create: `app/go/[ref]/route.ts`
- read mainly in dashboards/pages, not in payout code

**Linkage strength**
- weak as a financial source
- useful as redirect telemetry, not canonical payment attribution

**What breaks if broken**
- marketing analytics degrade
- does not directly stop payouts because payouts use `campaign_tracking_events`

---

## `conversions`

**Owns**
- unclear in current codebase

**Required IDs/fields actually relied on**
- none found in active audited routes

**Must link upstream to**
- unclear

**Downstream money movement depending on it**
- none found

**Routes create/read/write**
- no active `.from("conversions")` / `.from('conversions')` found in the audited app routes

**Linkage strength**
- missing / non-canonical

**What breaks if broken**
- if this table is intended as a ledger, it is already bypassed by the actual system
- creates architectural ambiguity about what a “conversion” officially is

---

## `campaign_tracking_events`

**Owns**
- real event ledger for `page_view` / cart / conversion-like events
- event amount and currency
- event attribution fields

**Required IDs/fields actually relied on**
- `id`
- `event_type`
- `affiliate_id`
- `campaign_id`
- `offer_id`
- `amount`
- `currency`
- `created_at`

**Must link upstream to**
- tracking link params or beacon params
- `live_campaigns`, `ad_ideas`, `live_ads`, `organic_posts`, or hostname fallback to `offers.site_host`

**Downstream money movement depending on it**
- `wallet_payouts.source_event_id`
- `app/api/process-conversion/route.ts` uses event row as the conversion source of truth
- legacy `app/api/track.gif/route.ts` also uses it to create both payout and deduction rows

**Routes create/read/write**
- create: `app/api/track-event/route.ts`, `app/api/track.gif/route.ts`
- read: `app/api/process-conversion/route.ts`, dashboards, manage-campaign pages

**Linkage strength**
- strongest tracking ledger in practice
- but weakened by multiple fallback rules and inconsistent `campaign_id` semantics
- `affiliate_id` appears to carry email values, not stable affiliate PKs

**What breaks if broken**
- wrong payout recipient
- wrong offer/business attribution
- duplicate payout creation if multiple processors touch the same event path
- hostname fallback can silently assign a conversion to the wrong offer

---

## `wallet_deductions`

**Owns**
- ad spend deductions from affiliate wallet
- legacy / alternative business-charge rows from conversion path in `app/api/track.gif/route.ts`

**Required IDs/fields actually relied on**
- `affiliate_email` for ad spend path
- `business_email`
- `offer_id`
- `ad_id` for `app/api/ad-spend/settle/route.ts`
- sometimes `source_event_id`, `campaign_id`, `status`, `reason`

**Must link upstream to**
- ad spend settlement: `live_ads.id`
- legacy conversion path: `campaign_tracking_events.id`

**Downstream money movement depending on it**
- wallet balance computations in `app/affiliate/wallet/page.tsx`, `app/api/ad-spend/settle/route.ts`, `app/api/meta/ad-insights/route.ts`, `app/api/meta/sync-active-ads/route.ts`
- optional Stripe transfer to business in ad-spend settlement route

**Routes create/read/write**
- create: `app/api/ad-spend/settle/route.ts`, legacy `app/api/track.gif/route.ts`
- read: wallet pages, spend guardrail routes, settlement routes
- update status: legacy `app/api/track.gif/route.ts`

**Linkage strength**
- mixed / duplicated
- ad spend settlement path is fairly strong because it records `ad_id`
- legacy conversion charge path creates a second deduction concept with different semantics
- still email-based and not normalized to one ledger model

**What breaks if broken**
- wallet balances become wrong
- ad spend could be charged twice or not at all
- business settlement traceability weakens if rows lack `ad_id` or rely only on `source_event_id`

---

## `wallet_payouts`

**Owns**
- affiliate commission obligations and payout execution state

**Required IDs/fields actually relied on**
- `id`
- `business_email`
- `affiliate_email`
- `offer_id`
- `amount`
- `status`
- `source_event_id`
- optional `cycle_number`, `available_at`, `is_recurring`, `stripe_transfer_id`

**Must link upstream to**
- conversion event in `campaign_tracking_events.id`
- `offers.id`
- business and affiliate profiles only via email lookups

**Downstream money movement depending on it**
- `app/api/run-payout/route.ts` charges business and transfers to affiliate

**Routes create/read/write**
- create: `app/api/track-event/route.ts`, `app/api/process-conversion/route.ts`, legacy `app/api/track.gif/route.ts`
- read/update: `app/api/run-payout/route.ts`, `app/business/payouts/page.tsx`, `app/business/dashboard/page.tsx`, `app/affiliate/dashboard/page.tsx`

**Linkage strength**
- strong on `source_event_id`
- weak on payer/payee identity because it uses `business_email` and `affiliate_email`
- duplicated creation paths are the biggest integrity risk

**What breaks if broken**
- duplicate payouts
- payout to wrong affiliate account
- inability to prove which business owes the payout if email changes or profile missing

---

## `wallet_topups`

**Owns**
- affiliate prefunding of wallet
- gross/net/refundable amounts

**Required IDs/fields actually relied on**
- `affiliate_email`
- `amount_net`
- `amount_refunded`
- `status`
- `stripe_id`

**Must link upstream to**
- Stripe checkout session / webhook
- affiliate identity by email

**Downstream money movement depending on it**
- spend guardrails and available wallet balance
- refund eligibility

**Routes create/read/write**
- create/write: `app/api/stripe/webhook/route.ts`
- read: `app/affiliate/wallet/page.tsx`, `app/api/ad-spend/settle/route.ts`, `app/api/meta/ad-insights/route.ts`, `app/api/meta/sync-active-ads/route.ts`, `utils/supabase/getRefundableBalance.ts`

**Linkage strength**
- moderate
- webhook path includes idempotency via `stripe_id`
- still email-based, and wallet balance also exists redundantly in `wallets`

**What breaks if broken**
- incorrect wallet availability
- spend may be paused incorrectly or allowed when underfunded
- refunds may exceed actual net balance if calculations diverge

---

## `wallet_refunds`

**Owns**
- refund history for affiliate wallet withdrawals/refunds

**Required IDs/fields actually relied on**
- `affiliate_email`
- `amount`
- `status`
- `stripe_refund_id`

**Must link upstream to**
- `wallet_topups` / Stripe charge lineage

**Downstream money movement depending on it**
- wallet availability / refundable balance computations

**Routes create/read/write**
- read: `app/affiliate/wallet/page.tsx`, `utils/supabase/getRefundableBalance.ts`
- refund API references: `app/api/stripe/refund/route.ts` and wallet UI

**Linkage strength**
- weak to moderate
- not clearly normalized against a canonical ledger in the audited files

**What breaks if broken**
- available balance drift
- refund double counting or inability to prove source top-up

---

## `business_profiles`

**Owns**
- business Stripe identities: `stripe_customer_id`, `stripe_account_id`

**Required IDs/fields actually relied on**
- `business_email`
- `stripe_customer_id`
- `stripe_account_id`

**Must link upstream to**
- business user/profile by email
- `offers.business_email`

**Downstream money movement depending on it**
- `app/api/run-payout/route.ts` charges business card via `stripe_customer_id`
- `app/api/ad-spend/settle/route.ts` transfers ad spend settlement to business via `stripe_account_id`
- legacy `app/api/track.gif/route.ts` business charge path

**Routes create/read/write**
- read/write in business settings and Stripe setup pages
- read in payout/settlement routes

**Linkage strength**
- weak to moderate because all joins are by `business_email`

**What breaks if broken**
- valid commission row cannot be paid
- ad spend settlement cannot transfer to business
- business identity can drift if email changes

---

## `affiliate_profiles`

**Owns**
- affiliate Stripe destination account
- avatar/profile fields used in UI

**Required IDs/fields actually relied on**
- `email`
- `stripe_account_id`

**Must link upstream to**
- affiliate auth/profile by email
- campaign/creative ownership via `affiliate_email`

**Downstream money movement depending on it**
- `app/api/run-payout/route.ts` affiliate transfer destination
- legacy `app/api/track.gif/route.ts` affiliate payout context

**Routes create/read/write**
- affiliate settings / Stripe connect routes
- read in payout route and organic approval UI avatar lookup

**Linkage strength**
- weak to moderate because it is email-based rather than FK-based

**What breaks if broken**
- payout cannot be completed
- wrong affiliate may receive funds if email/profile mapping drifts

---

## `meta_connections`

**Owns**
- business Meta auth context: `access_token`, `page_id`, `ad_account_id`, maybe currency

**Required IDs/fields actually relied on**
- `business_email`
- `access_token`
- `page_id`
- `ad_account_id`
- `created_at` / `updated_at`

**Must link upstream to**
- business identity via `business_email`
- `offers.meta_page_id` / `offers.meta_ad_account_id`

**Downstream money movement depending on it**
- indirect but important: without it, no live Meta ad means no spend, no paid tracking, no settlement
- spend sync and auto-pause depend on ability to read Meta insights

**Routes create/read/write**
- read heavily in `app/affiliate/dashboard/promote/[offerId]/page.tsx`, `app/api/meta/callback/upload-video/route.ts`, `app/api/meta/ad-insights/route.ts`, `app/api/meta/sync-active-ads/route.ts`, business manage pages

**Linkage strength**
- moderate
- business lookup is email-based, but offer-specific Meta selection improves precision

**What breaks if broken**
- ads may launch against wrong account
- spend sync fails
- auto-pause guardrails fail

---

## Questions answered

## A. Commission ownership

### How does the system know which business owes commission?
Primarily through `offers.business_email`.

Active paths:
- `app/api/process-conversion/route.ts` resolves `campaign_tracking_events` -> `live_campaigns` -> `offer_id` -> `offers.business_email`, then writes `wallet_payouts.business_email`
- `app/api/track-event/route.ts` loads `offers.business_email` directly from `inserted.offer_id` and writes `wallet_payouts.business_email`
- `app/api/run-payout/route.ts` then reads `wallet_payouts.business_email` and finds `business_profiles.stripe_customer_id`

### Is commission always resolved through `offer_id`?
In current active code: effectively yes.

But resolution is fragile because `offer_id` may be recovered through multiple fallbacks:
- `live_campaigns`
- `ad_ideas`
- `live_ads`
- `organic_posts`
- `offers.site_host`
- final fallback where `campaign_id === offers.id`

So commission is offer-based, but the offer can be derived weakly.

### Can a conversion create a payout without a valid offer?
- `app/api/process-conversion/route.ts`: no, it hard-fails with `offer_not_resolved` / `offer_not_found`
- `app/api/track-event/route.ts`: payout insert only runs when `inserted.offer_id` exists
- legacy `app/api/track.gif/route.ts`: it can skip payout cleanly if campaign/offer resolution fails

So active payout creation needs an offer, but offer resolution can be indirect and stale.

### Can a payout be created for an unapproved affiliate?
Yes, this is not tightly prevented in the audited code.

Reason:
- payout creation routes do not re-check `affiliate_requests.status === "approved"`
- `ad_ideas` and `organic_posts` submit flows shown here do not prove approved-request enforcement at the write edge
- if an affiliate gets a valid tracking link and a conversion event is recorded, payout logic relies on event/campaign/offer fields, not current approval state

### Can commission percent be missing or stale?
Yes.
- missing: `process-conversion` rejects `commissionPct <= 0` as `invalid_commission`
- stale: old live campaigns/payouts always use current `offers.commission` at processing time unless commission was snapshotted elsewhere, which it was not in the audited paths

Assessment: **Important before scale**.

---

## B. Ad spend ownership

### How does the system know which affiliate wallet pays ad spend?
Through `live_ads.affiliate_email`.

`app/api/ad-spend/settle/route.ts`:
- loads `live_ads.id, affiliate_email, business_email, offer_id, spend, spend_transferred`
- sums `wallet_topups` and `wallet_deductions` by `affiliate_email`
- inserts `wallet_deductions.affiliate_email = liveAd.affiliate_email`

### How does it know which business receives ad spend settlement?
Through `live_ads.business_email` -> `business_profiles.stripe_account_id`.

### Are `live_ads` linked clearly to offer, affiliate, business, and Meta ad IDs?
Mostly yes, but with identity drift risk.

They carry:
- `offer_id`
- `affiliate_email`
- `business_email`
- `meta_campaign_id`
- `meta_ad_id`
- `ad_set_id`
- `creative_id`
- `ad_idea_id`

Weakness:
- these are not stable FK joins to business/affiliate entities
- `campaign_id` semantics are overloaded and later rewritten to `live_ads.id`

### Can spend be transferred/deducted twice?
Reduced but not eliminated.

Good guard:
- `app/api/ad-spend/settle/route.ts` uses optimistic locking on `live_ads.spend_transferred`

Residual risk:
- if `live_ads` claim succeeds but `wallet_deductions` insert/rollback partially fails, bookkeeping can drift
- separate sync/control flows touch the same spend state
- legacy/alternative deduction semantics also exist in `app/api/track.gif/route.ts`

### Is `spend_transferred` reliable?
Reasonably reliable as an idempotency counter for one `live_ads` row, but not a complete ledger proof.

It is strong for “how much of this ad’s spend has been settled”.
It is weak as the sole audit artifact because it is mutable state, not append-only ledger.

Assessment: **Critical before launch** for stronger ledgering around ad settlement.

---

## C. Organic tracking ownership

### How are organic posts/campaigns linked to affiliate, offer, and business?
- `organic_posts` is inserted with `offer_id`, `affiliate_email`, `business_email`, `status: "pending"`
- approval inserts `live_campaigns` with `offer_id`, `affiliate_email`, `business_email`, `status: "live"`

### Are tracking links unique and traceable?
Partially.
- affiliate promote page generates `https://www.nettmark.com/go/${offerId}___${userEmail}`
- `/go/[ref]` expects `campaignId___affiliateId___campaignType` but accepts multiple legacy formats
- organic tracking can therefore use offer-id-as-campaign-id fallback, which is traceable but not cleanly unique per campaign

### Can organic conversions be paid correctly?
Often yes, because `app/api/process-conversion/route.ts` resolves `event.campaign_id` through `live_campaigns`, then `offer_id`, then `offers.commission`.

But if event payloads are incomplete and fallback logic lands on hostname or legacy offer-id behavior, correctness becomes weaker.

### Are approved organic posts separated from pending/rejected ones?
Yes in the review UI and approval flow:
- `organic_posts.status` is updated to `approved` or `rejected`
- only approval path inserts `live_campaigns`

Assessment: **Important before scale** due to weak tracking-link identity.

---

## D. Approval integrity

### Can ads or organic posts go live without business approval?
- organic: live insertion was only observed on approval path, so mostly no
- paid ads: `live_ads` insertion happens in `app/api/meta/callback/upload-video/route.ts`, and the intended trigger is business approval -> `sendToMeta()`

However, this is not the same as a hard backend rule. The audited code does not show a strict server-side guard like “reject launch unless `ad_ideas.status === approved`”.

### Can a campaign be created from an ad idea that was not approved?
Potentially yes if `sendToMeta()` or the underlying route is called directly with a valid `adIdeaId`/`offerId`, because the server route reads the row but does not visibly enforce `ad_ideas.status === "approved"` before creating Meta objects and `live_ads`.

### Can an affiliate promote an offer without approved `affiliate_request` status?
Potentially yes.
The audited submission paths do not show a definitive server-side check against `affiliate_requests.status === "approved"` before inserting `ad_ideas` or `organic_posts`.

### Are rejected/pending items blocked from money flows?
Not reliably enough.
Once tracking events exist, payout logic does not consult current approval tables.

Assessment: **Critical before launch**.

---

## E. Tracking integrity

### Which tracking table is canonical: `clicks`, `conversions`, or `campaign_tracking_events`?
`campaign_tracking_events` is canonical in active money logic.

- `clicks` is a redirect telemetry table
- `conversions` appears unused / non-canonical
- `campaign_tracking_events` is what payout processors read

### Are there duplicate tracking paths?
Yes.
- `/go/[ref]` -> `clicks`
- `/api/track.gif` -> `campaign_tracking_events` and legacy financial side effects
- `/api/track-event` -> `campaign_tracking_events` and payout side effects
- `/api/process-conversion` -> reads `campaign_tracking_events` and creates payouts again

### Are events always tied to `campaign_id`, `offer_id`, `affiliate_id`, and business?
No.
- `business_email` is not stored directly on the event row in the audited route
- `offer_id` can be missing and then inferred through fallbacks
- `campaign_id` may be internal UUID, Meta numeric ID, live ad id, live campaign id, or even `offers.id`
- `affiliate_id` appears to carry email, not stable affiliate PK

### Are cookies/tracking links mapped consistently?
Not consistently.
- `/go/[ref]` writes cookie `nettmark_affiliate_id`
- query params use `nm_aff`, `nm_camp`, `nm_src`
- some flows use `offerId___affiliateEmail`
- route parser expects optional `campaignType`
- multiple fallback branches exist to recover meaning later

### Are paid Meta and organic campaigns using the same or different tracking model?
Different at runtime, partially unified only at event ingestion.
- paid uses `live_ads` and Meta identifiers
- organic uses `live_campaigns`
- both eventually feed `campaign_tracking_events`, but with different identity semantics and fallback paths

Assessment: **Critical before launch**.

---

## F. Payment linkage

### Does every `wallet_deduction` link back to the campaign/ad/spend source?
No.
- ad spend settlement path is relatively good: it writes `ad_id`, `offer_id`, `affiliate_email`, `business_email`
- legacy conversion charge path in `app/api/track.gif/route.ts` writes `source_event_id`, `campaign_id`, `offer_id`, `business_email`, but not `ad_id`

So payment-row linkage is not uniform.

### Does every `wallet_payout` link back to the conversion `source_event_id`?
In active audited creation paths, yes.
That is the strongest current linkage in the system.

### Does every payout know the business payer and affiliate recipient?
Yes, but mostly by email:
- `wallet_payouts.business_email`
- `wallet_payouts.affiliate_email`

### Are there any payment rows that only use email and no stable ID?
Yes, many.
- `wallet_payouts` payer/payee identity is email-based
- `wallet_deductions` wallet owner/business owner are email-based
- `wallet_topups` and `wallet_refunds` are email-based
- profile joins are via `business_email` / `email`

Assessment: **Important before scale**.

---

## G. Risk ranking

### Critical before launch
1. **Duplicate payout creation paths**
   - `app/api/track-event/route.ts`
   - `app/api/process-conversion/route.ts`
   - legacy `app/api/track.gif/route.ts`
   These overlap on conversion processing and financial side effects.

2. **Approval not enforced at money boundaries**
   - payout and tracking processors do not re-check `affiliate_requests`
   - `app/api/meta/callback/upload-video/route.ts` does not visibly enforce approved `ad_ideas.status`

3. **Inconsistent `campaign_id` identity model**
   - internal UUIDs, Meta IDs, `live_ads.id`, `live_campaigns.id`, and `offers.id` can all appear in the same conceptual slot

4. **Tracking attribution depends on fallback heuristics**
   - especially `offers.site_host` hostname fallback and legacy offer-id path

5. **No single canonical financial ledger model**
   - mutable `spend_transferred`
   - mixed `wallet_deductions` semantics
   - legacy charge path in `app/api/track.gif/route.ts`

### Important before scale
1. **Email-based joins for business and affiliate ownership**
2. **Commission percent can be stale at processing time**
3. **`conversions` table is non-canonical / unclear**
4. **Wallet balance logic is duplicated**
   - recomputed from ledger rows in some places
   - mirrored in `wallets.balance`
   - `utils/supabase/getRefundableBalance.ts` uses `wallet_spends`, while other active logic uses `wallet_deductions`

5. **Organic tracking links are not uniquely campaign-scoped by design**

### Cleanup later
1. Normalize status vocabulary (`pending`, `approved`, `live`, `active`, `completed`, `paid`)
2. Remove legacy fallbacks once canonical IDs exist
3. Collapse duplicated commission display fields vs payout math (`commission_value` vs `commission`)
4. Align Stripe API versions across routes

### Safe for now
1. `wallet_payouts.source_event_id` idempotency concept
2. `live_ads.spend_transferred` optimistic-lock claim pattern
3. separation of pending vs approved UI flows for `organic_posts` and `ad_ideas`
4. using `offers` as the practical commercial root object

---

## H. Proposed canonical object model

Do not implement yet; this is the clean future model.

### 1. `Offer`
Canonical fields:
- `offer_id`
- `business_id`
- `commission_percent`
- `payout_schedule_snapshot_defaults`
- `destination_url`
- `tracking_domain/site_host`
- `meta_config_id`
- immutable commercial version / effective timestamps

Rule:
- all commission ownership derives from `offer_id -> business_id`

### 2. `AffiliateApproval`
Canonical fields:
- `affiliate_approval_id`
- `offer_id`
- `affiliate_id`
- `business_id`
- `status`
- `approved_at`, `rejected_at`
- reason / reviewer metadata

Rule:
- no creative, campaign, or payout may exist without a valid approval snapshot

### 3. `CreativeApproval`
Canonical fields:
- `creative_id`
- `offer_id`
- `affiliate_id`
- `business_id`
- `creative_type` (`paid_meta_ad`, `organic_post`)
- `source_submission_id`
- `affiliate_approval_id`
- `status`
- approved/rejected timestamps

Rule:
- `ad_ideas` and `organic_posts` become submission tables feeding this canonical approval object

### 4. `Campaign`
Canonical fields:
- `campaign_id`
- `campaign_type` (`paid_meta`, `organic`)
- `offer_id`
- `affiliate_id`
- `business_id`
- `creative_id`
- `affiliate_approval_id`
- `status`
- external ids (`meta_campaign_id`, `meta_ad_id`, etc.) in a namespaced external mapping

Rule:
- one internal `campaign_id`; external platform IDs are attributes, never substitutes

### 5. `TrackingEvent`
Canonical fields:
- `tracking_event_id`
- `campaign_id`
- `offer_id`
- `affiliate_id`
- `business_id`
- `event_type`
- `occurred_at`
- `amount`, `currency`
- raw payload
- attribution method

Rule:
- event write should fail or quarantine if campaign/offer/affiliate/business cannot be resolved exactly
- no hostname fallback in the final model except explicit quarantine handling

### 6. `Conversion`
Canonical fields:
- `conversion_id`
- `tracking_event_id`
- `campaign_id`
- `offer_id`
- `affiliate_id`
- `business_id`
- `gross_amount`
- `commission_percent_snapshot`
- `commission_amount`
- status

Rule:
- exactly one canonical conversion record per billable event
- payout generation reads this object only

### 7. `WalletLedger / PaymentLedger`
Canonical append-only ledger entries:
- `ledger_entry_id`
- `entry_type` (`wallet_topup`, `wallet_refund`, `ad_spend_hold`, `ad_spend_settlement`, `commission_payable`, `commission_payout`, `business_charge`, `business_transfer`)
- `business_id`
- `affiliate_id`
- `offer_id`
- `campaign_id`
- `conversion_id`
- `tracking_event_id`
- `external_payment_id`
- signed amount / currency
- status
- created_at

Rule:
- derived balances come from ledger sums
- mutable counters like `spend_transferred` can remain as cached projections, not source of truth

---

## Recommended next-spec decisions

1. Declare `campaign_tracking_events` the only canonical tracking event table.
2. Declare `wallet_payouts` creation to happen in exactly one backend path only.
3. Require every payable conversion to resolve exact:
   - `offer_id`
   - `campaign_id`
   - `affiliate_id`
   - `business_id`
   with no hostname fallback for billable events.
4. Make `affiliate_requests.status === "approved"` and creative approval hard backend prerequisites for campaign launch and payout eligibility.
5. Replace email-based financial joins with stable IDs, while retaining emails as denormalized display snapshots.
6. Unify paid and organic under one internal `Campaign` identity model.
7. Treat `conversions` as either:
   - the future canonical billable table, or
   - dead/legacy and removable.

---

## Final assessment

Today, Nettmark has a workable commercial chain, but not yet a tight one.

The strongest current backbone is:
- `offers`
- `live_ads` / `live_campaigns`
- `campaign_tracking_events`
- `wallet_payouts.source_event_id`

The main architectural weakness is that the chain is stitched together by a mix of:
- fallbacks
- mutable state
- duplicated processors
- email-based ownership
- inconsistent campaign identifiers

That is acceptable for early prototyping, but not strong enough for high-confidence launch billing without tightening the canonical linkage model first.