# Business trial-first experiment
Status: in progress. Founder approved reviewed proposal on 2026-10-05.

## Problem and product intent
65 recent business signups produced about 37 offers but very few trials and no paid conversions. Test whether making affiliate-funded paid distribution the natural next step improves campaign activation and paid conversion, preserving Free, approvals and financial control. Grounded in docs/VISION.md, PRODUCT_PRINCIPLES.md, PRODUCT.md, BUSINESS_RULES.md, UI_DESIGN_SYSTEM.md, ARCHITECTURE.md, DATABASE.md, MONEY_FLOW.md, TRACKING.md and META_ADS.md.

## Scope and acceptance
New business signups from a fixed prospective UTC rollout cutoff (2026-10-05 04:00 UTC), assigned deterministically 50/50 by business UUID to plan_choice_v1/control and trial_first_v1/treatment. No query-string overrides. Previous/legacy/grandfathered/subscribed businesses keep existing choices and billing. Assignment remains stable after conversion. Treatment follows persisted owned offer creation at /business/choose-plan; one trial CTA, clear current Stripe price/currency and existing 14-day duration, card requirement, renewal/cancellation terms and visible Continue with Free. Visiting never creates a Stripe customer, subscription, trial or charge.

## Existing implementation and evidence
app/onboarding/for-business/page.tsx writes offers directly, does not emit builder/publish events, ignores completion HTTP errors. Root BusinessProductAnalytics emits views before auth readiness and matches plan button text. choose-plan references a missing eligibility route, hardcodes price and trusts checkout_returned without session verification. Current checkout already requires a card and grants eligible trials; webhook is entitlement authority with persisted Stripe event IDs. Commission customer is separate from subscription customer.
Live Supabase read-only schema verified in review. Existing product event names/JSON metadata suffice; no migrations. Existing report uses rolling signup and outcome windows, organic live_campaigns only and active entitlement as paid proxy. Historical builder absence is unknown telemetry, not proof businesses skipped creation.
PRODUCT affiliate onboarding description is stale against current V1; no affiliate flow changes. Subscription gate settings/runtime configuration and actual live Stripe price were not accessible; retrieve configured Stripe Price server-side. Separate existing RLS/grant findings remain out of scope.

## Approach and files
Shared deterministic cohort helper; read-only authenticated eligibility/price route; compact continuation component matching mobile Business Overview (canonical page/component/CSS/globals inspected). Instrument actual signup, builder, publish, plan actions and auth-ready dashboard. Verify owned offer on business completion and retry completion without duplicate inserts. Explicit requireTrial checkout guard; authenticated owned completed Checkout return only; confirmed Free logs without changing entitlements. Extend signed webhook JSON facts with invoice amounts/currency, trial/cancellation timing and cohort metadata while preserving financial sync/replay behavior.
Extend existing marketing report with fixed signup dates, observation-through date, stable cohort comparison and durable offer/request/Meta/paid-ad/trial/cancellation/positive-live-invoice outcomes; retain existing acquisition architecture. Separate campaign creation from observed spend.

## Risks and trade-offs
50/50 samples are small: evaluate signup-to-campaign-to-paid outcomes, not trial starts alone; allow full trial follow-up. Free retains requests, organic and setup; Growth enables paid approval/launch, not exclusive Meta connection/tracking. Meta bills business accounts and Nettmark reimburses separately; no risk transfer claims. Failed analytics cannot block offer save/billing. Stripe unavailable => trial action disabled with visible retry/Free, never unverified pricing. Cancellation requested versus ended and test versus live invoices must be distinct. Reporting caps warn rather than silently claim complete data. No pricing/env/database/advertising changes.

## Validation
Planned: deterministic cohort and signup-window tests; historical outcomes/repeated invoices/test invoices/missing events/cancellation tests; mocked ownership, checkout and retry failures; subscription/gate/payment/affiliate regressions; scoped strict type checks, lint and mobile/desktop browser checks; PR/Vercel builds. Record actual results before completion.
