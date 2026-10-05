# Business trial-first full rollout
Status: in progress. Founder requested 100% new-business rollout on 2026-10-05.

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
Planned: deterministic boundaries/all UUIDs; durable reporting separation; actual eligibility/completion route cases for the previously-control UUID, existing Free and subscribed exclusions; existing business billing/type/browser CI and marketing checks. Live Stripe testing remains founder-owned. No production charges.

## Remaining work
Implement, run scoped CI, merge and verify production deployment before full-rollout enrollment.
