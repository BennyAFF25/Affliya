# Business trial-first full rollout
Status: completed. Founder requested 100% new-business rollout on 2026-10-05.

## Problem and product intent
The initial 50/50 experiment leaves half of new businesses on the old equal-plan decision. Founder prefers faster exposure and iteration while acquisition is strong, accepting weaker causal evidence from historical comparisons. This explicit direction revises the earlier allocation decision, aligned with VISION.md and PRODUCT_PRINCIPLES.md simplicity/value-first goals. Free, explicit checkout confirmation, existing pricing and meaningful financial control remain intact.

## Existing implementation and affected systems
utils/businessOnboardingFunnel.ts assigns signup UUID parity from 06:00 UTC. Eligibility and onboarding completion explicitly recognize trial_first_v1. utils/marketing/businessFunnel.ts derives immutable cohorts from signup dates/UUIDs; marketing dashboard shows three groups. Billing writes/webhooks are unchanged. See docs/PRODUCT.md, BUSINESS_RULES.md, ARCHITECTURE.md, TRACKING.md and UI_DESIGN_SYSTEM.md. Historical docs/experiments/business-trial-first-v1.md describes the now-superseded 50/50 decision; preserve its original cohort.

## Intended behaviour and approach
Add a prospective full-rollout cutoff (2026-10-05 07:00 UTC). All valid new-business identities from that time get trial_first_v1_100; prior assignments remain immutable, including the 06:00–07:00 randomized cohort. Share treatment recognition in eligibility/completion. Extend the existing report with a separate full-rollout group and explicit comparison limitations. No forced variant, account updates, migrations, remote configuration, pricing, checkout, affiliate onboarding or visual design changes.

## User impact and success criteria
New eligible businesses publish an offer, then see the existing trial-first continuation with visible Free. Existing Free/subscribed/legacy accounts stay protected by existing guards. All 256 UUID suffixes after the new cutoff must receive treatment, while earlier allocations remain unchanged. Screen visits never enroll or charge.

## Trade-offs and risks
100% removes a concurrent randomized comparison for future signups. Compare activation, cancellation and positive payment over equally mature cohorts; do not attribute change causally or optimize trial starts alone. Rollback must preserve actual subscriptions and historical assignments; use a future allocation cutoff rather than reassigning existing businesses. Deploy before the prospective cutoff; adjust it before enrollment if release is delayed.

## Validation
Passed on 51974f3485640b7876a4c525a6fac1de61df2918:
- Business run 37271138588: all 256 UUID suffixes get treatment after full cutoff; one-millisecond boundary preserves prior assignments; four cohorts stay separate in durable reporting. Actual eligibility/completion and explicit checkout tests retain new version metadata and prior-trial/Free/subscribed exclusions.
- Existing billing/entitlement/gate/payment-profile suites, new strict typecheck, touched-integration baseline comparison and lint passed.
- Actual authenticated Next browser checks passed at 320x568, 390x650 and 1280x800 using full-rollout context; pricing/card/cancellation terms, visible Free, unavailable pricing, trial rejection, foreign returns and saved-offer retry remain covered.
- Marketing run 37271138604 passed reporting and dashboard/API strict types.
- Affiliate run 37271138392 passed existing regressions/types/lint/browser checks.
- Vercel preview build succeeded. Production deployment is verified after merge.

No migrations, database changes, remote configuration or pricing changes. Live Stripe testing remains founder-owned; no production charges were made. Full-repository pre-existing type debt is outside scope; scoped checks passed. Remaining measurement risk: no concurrent randomized control after full rollout; full trial follow-up still required.

## Delivery
Merge to main under persistent user authorization and verify production deployment before full-rollout enrollment. Completed feature validation is recorded above; deployment status is reported to the founder after release.
