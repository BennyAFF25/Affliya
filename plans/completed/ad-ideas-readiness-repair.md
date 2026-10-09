# Ad Ideas readiness repair

**Status:** completed

## Problem
Production Ad Ideas showed `Setup required` for a funded, approved affiliate campaign and prompted the business to connect billing even after setup. Live inspection found two causes:
- `utils/paidCampaignLaunchReadiness.ts` queries `business_activation_subsidies`, but production did not have the compatibility table, causing campaign readiness to collapse to `READINESS_CHECK_FAILED`.
- `app/business/my-business/page.tsx` could treat a browser `localStorage` card flag as authoritative while Ad Ideas/launch checked Stripe server-side.

## Product intent
Keep setup contextual and accurate. Users should see launch blockers only when they are real. This aligns with `docs/VISION.md`, `docs/PRODUCT_PRINCIPLES.md`, and `docs/BUSINESS_RULES.md`: hide infrastructure, minimise unnecessary friction, and keep payment/campaign state dependable.

## Intended behaviour
- Missing optional activation-subsidy storage must not crash campaign funding readiness.
- The compatibility table defaults to A$0 and does not enable the retired automatic A$10 programme.
- Business billing readiness must come from the same server-side Stripe-backed helper used by paid campaign launch.
- No wallet, commission, Meta launch, ad-spend settlement, pricing, or entitlement rules change.

## Existing implementation
- Campaign readiness: `app/api/business/ad-ideas/review-readiness/route.ts` → `utils/paidCampaignLaunchReadiness.ts`.
- Canonical business payment readiness: `utils/businessPaymentReadiness.ts`.
- Business dashboard billing UI: `app/business/my-business/page.tsx`.
- Compatibility storage migration: `supabase/migrations/20261009010100_activation_subsidy_storage_compatibility.sql`.

## Implementation
1. Apply the existing zero-subsidy compatibility migration to production.
2. Route `/api/stripe/check-customer-card` through `getBusinessPaymentReadiness`.
3. Remove the browser `nm_has_card_*` shortcut and re-check the server after SetupIntent completion.
4. Validate schema/RLS, focused billing tests, and the affected campaign readiness data.

## Validation
- Production compatibility table exists with RLS enabled and zero rows immediately after creation.
- Existing James campaign still has A$15 required funding and A$15 canonical wallet credit; affiliate participation is approved.
- Focused billing regression test asserts no browser card cache can mark billing ready and both UI/launch use the shared server helper.
- Supabase security advisors reviewed after the schema change.

## Remaining risk
The commission-billing Stripe customer is intentionally separate from the Growth subscription customer. If the commission customer genuinely has no saved card, Ad Ideas should continue to show billing required; this is expected rather than a readiness bug.


## Follow-up: duplicate Stripe billing clarity
A live business test confirmed the original funding failure was repaired: the proposal correctly reported affiliate campaign funding ready. The remaining blocker was real commission billing. Nettmark deliberately uses a separate Stripe account for Business/Growth subscription billing and transaction/commission billing (historical commit `298e9aafb33ec68cb81a6e3cdb09e937755e66f9`). A payment method saved to one Stripe account cannot be reused as a customer payment method on the other account.

The proposal detail now:
- labels the blocker as `Commission billing required` instead of generic `Setup required`;
- opens the transaction-account SetupIntent directly inside the proposal;
- explains that Growth is already active and affiliate ad spend remains $0;
- re-checks the canonical server-side Stripe payment readiness after card setup;
- shows only the affiliate's Nettmark username, with rejection notification delivery resolved server-side rather than exposing the affiliate email to the proposal review client.

No subscription pricing, commission calculation, wallet funding, Meta launch, or settlement logic changed.


## Follow-up: first live Meta launch failure
The first real campaign launch reached Meta successfully but Meta rejected campaign creation before creating any campaign object. The returned error was code 100 / subcode 4834011: ad-set-budget campaigns must explicitly set `is_adset_budget_sharing_enabled`.

Production state was verified before retry:
- proposal `701f7447-be06-474b-9d2f-dfc237eaa88f` returned to `pending`;
- `meta_campaign_id` remained null;
- no `live_ads` row exists;
- therefore a single retry after the payload fix is safe.

Repair:
- campaign creation now sends `is_adset_budget_sharing_enabled: false`;
- Meta's user-facing rejection message is returned to the UI;
- launch UI refreshes readiness and then restores the launch error instead of clearing it;
- proposal approval webhook inserts are deduplicated by proposal ID;
- pre-login global Supabase sign-outs were removed because login must not revoke unrelated active sessions.

The Meta route still contains hard-coded Graph API v19 URLs. That version drift is tracked as follow-up technical debt rather than changed during the first live-money launch repair.


## Follow-up: second live launch — Advantage Audience conflict
The next real launch reached Meta campaign creation successfully, then failed before creating any ad set. Production verification found:
- proposal `5685c237-8a5d-4529-bc5c-9b97f41a4b7c`;
- partial Meta campaign `120251749965860679`;
- zero ad sets and zero ads under that campaign;
- no `live_ads` row in Nettmark.

A validation-only replay of the exact ad-set payload returned Meta code 100 / subcode 1870189:
`With ad sets that use Advantage+ audience, the maximum age audience control can't be set to lower than 65.`

The proposal requested ages 25–55 while `advantage_audience` was enabled. Re-validating the same payload with `advantage_audience: 0` returned `200 { success: true }`.

Repair:
- preserve explicit affiliate age ranges by disabling Advantage Audience when max age is below 65;
- validate the ad set with Meta before creating it;
- create the parent campaign PAUSED;
- create the local `live_ads` row as paused;
- activate the Meta campaign only after the local live row is durable;
- clean up partial Meta campaigns and clear `ad_ideas.meta_campaign_id` on downstream Meta/database failures;
- surface stage-specific Meta errors;
- show `Meta cleanup required` instead of a generic `Checking` state if cleanup ever fails.

This keeps campaign intent authoritative and prevents untracked Meta spend during partial launches.
