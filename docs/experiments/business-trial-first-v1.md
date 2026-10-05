# Business trial-first V1

Founder-approved 50/50 experiment. Assignment starts with business signups at the immutable cutoff exported by utils/businessOnboardingFunnel.ts. UUID last byte parity allocates trial_first_v1 or plan_choice_v1. Previous accounts are pre_experiment. Do not move the cutoff once production enrollment begins, change prices, or force a variant with query parameters.

Treatment goes directly from persisted owned offer to /business/choose-plan. Growth enables paid campaign approval/launch, while Free retains affiliate participation, organic promotion and setup. The authenticated read-only eligibility route loads actual Stripe price/currency and the existing 14-day duration. Stripe Checkout still requires a card and explicit confirmation. Webhooks grant subscription access; commission billing and launch readiness remain separate.

## Measurement
Use /internal/marketing with fixed signupFrom/signupTo UTC dates, where signupTo is exclusive. Leave observedThrough empty to follow that same cohort over time; set it to a UTC midnight to reproduce an as-of report. The controls preserve these parameters in the URL.
A reproducible historical signup baseline is /internal/marketing?signupFrom=2026-09-28&signupTo=2026-10-05. Compare it with equally aged control/treatment cohorts after rollout. It is observational context, not randomized evidence. The founder-provided rolling 7-day snapshot was approximately 65 signups, 37 offer publishers, 36 plan-screen visitors, 24 Free clicks, 3 Growth clicks, 4 checkouts, 3 trials and 0 currently paid. Its exact timestamps are unknown, so these values are not backfilled into event tables.

All stable signup identities enter the denominator, including dropouts without events. Database outcomes: saved offers, affiliate_requests, meta_connections with page/account IDs, paid live_ads with actual Meta IDs, and entitlement trial-start history. Behaviour: explicit authenticated product events with server-derived cohort metadata. Signed Stripe events record trial/cancellation times, live-mode invoice ID, integer amount_paid and currency in existing JSON. A positive live invoice is payment evidence; a zero trial invoice or active entitlement alone is not. Missing historical invoice facts remain unknown.

Primary outcomes: signup-to-trial, signup-to-paid-campaign, signup-to-positive-payment, with trial cancellation and Free usage as guardrails. Campaign creation and observed spend are separate. Spend and current entitlement panels are current snapshots; avoid treating them as historical state. Wait at least a full trial plus payment processing for mature comparisons. No significance/activation uplift is claimed by shipping this experiment.

## Scope and rollback
No migrations, new plans, changed prices, gate settings, billing enrollments, ad campaigns or affiliate onboarding changes. Reverting the UX retains existing persisted billing/subscriptions and audit facts; never roll back customer billing state to undo the experiment. The pre-existing billing webhook replay/failure behavior is preserved. Existing RLS findings and production gate configuration are separate remediation/verification work.
