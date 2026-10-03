# Affiliate onboarding and AI promotion pack V1

Status: implementation complete; founder browser acceptance pending. Base: cb511b0301fb071aa3299528c706840b4ed09d2e. Founder authorized implementation on a separate branch for testing; no main merge, deployment, remote configuration or migration is authorized.

## Problem and product intent
The existing affiliate wizard collects preferences but always activates Nettmark's system offer. The marketplace now has multiple offers and most businesses may have no brand content. Move users directly from choosing a real offer to preparing a useful promotion, following docs/VISION.md and docs/PRODUCT_PRINCIPLES.md (value before setup, quiet AI assistance, business control).

## Intended behavior and scope
Replace the welcome/preference/system-offer wizard with authenticated marketplace selection, explicit join/request, and a direct continuation to the existing paid or organic Promote page. Show actual commission terms without earnings guarantees. Pending offers remain pending and users can choose another offer. Keep Nettmark as an ordinary optional offer. Defer affiliate public name; preserve selected offer and mode through signup/verification. Add one reusable Generate with AI panel to Promote, including entry from onboarding. Return the complete seven-field text pack from saved server-side offer/brand context; explicit application only; preserve edits and approval rules. No bulk requests, new Pro billing, image generation, auto-publication, tracking changes or wallet/payout changes.

## Existing implementation
- app/onboarding/for-partners/page.tsx: four labeled steps, five states, first-party offer.
- app/api/affiliate/offers/[offerId]/start/route.ts and utils/approvals/enforcement.ts: open/pending/private/rejected participation.
- app/affiliate/dashboard/promote/[offerId]/page.tsx: paid proposal insert, reviewed organic insert, unchanged-caption preapproved fast path.
- OrganicSubmissionForm currently labels preapproval from flags only, unlike the handler which also requires social method and unchanged caption; align these predicates.
- app/api/profile/onboarding-complete/route.ts currently applies business conversion tracking and billing cookies to affiliates; add a role-specific early return.
- create-account/auth-redirect do not consistently preserve the onboarding destination after email verification.
- offers, business_profiles, business_creatives provide context; checked-in code establishes expected fields, not live schema/population.
- Canonical UI: MobileBusinessOverview.tsx, mobile-business.css, corresponding integration and globals.css overrides. Preserve the visual language and existing theme behavior.

## Architecture and downstream boundaries
Session-authenticated API -> active offer/access verification -> server-side context allowlist -> distributed quota reservation -> bounded OpenAI Responses request -> runtime-validated pack. No model access to credentials or financial/customer records. No tools, scraping or autonomous actions. AI is disabled unless feature flag, provider key and shared Redis quota configuration are present. No new dependencies or database writes for generation. Existing submission types receive applied text on explicit submit. Existing launch/tracking/payment checks remain authoritative.

## Validation
Recorded on 31ca6b6b76f28c60eee01ea947863f387409c7a4: GitHub Actions regression tests, strict new-feature types, new-feature ESLint and integration diagnostic comparison all passed. Existing integration dependency graph has 9 diagnostics on main and 9 here, with zero new errors. Vercel preview build succeeded. Final UI polish preserves the same required checks. Browser, live RLS/schema/population and real provider calls remain unverified; founder tests the preview. No main merge, migration, dependency or remote configuration change.
Add behavioral tests for offer visibility/ranking, access, internal return destinations, context exclusion, exact pack structure, changed-caption review, provider failures/timeouts and atomic quota rejection. Add focused GitHub Actions tests/typechecking because this session has no shell/test runner. Review the complete diff and CI output; report browser/production checks unavailable. Add a manual testing/configuration guide and sanitized operational metrics.

## Risks and trade-offs
No live schema, policy or populated context verification yet; use existing entities and fail closed on core read/auth errors. Saved copy can be thin; do not invent claims. Image/video remains required for paid proposals. Unapplied packs are temporary. Quota attempts are bounded; no new billing/Pro. Avoid the existing client-side Meta credentials query in AI context. Legacy preapproved readiness differences remain; this work neither generalizes link-only instant promotion nor bypasses merchant review. No numeric activation uplift promise.

## Success criteria
Affiliate can select a third-party offer and continue to a useful promotion without a survey, first-party enrollment or payout setup. Pending/rejected/private restrictions remain intact. AI returns exactly one angle, three hooks, primary copy, headline, CTA, organic caption and explanation, and cannot change approval state or budgets. Missing AI configuration leaves manual promotion usable. Branch tests and focused checks pass, with limitations recorded.

## Delivery
Branch: codex/affiliate-onboarding-ai-v1. Draft PR: https://github.com/BennyAFF25/Affliya/pull/10. Test and configuration guide: docs/AFFILIATE_ONBOARDING_V1.md. Preview: https://affliya-git-codex-affiliate-onboa-8f948f-bens-projects-28b82cca.vercel.app/onboarding/for-partners. AI remains off until server credentials and shared quota storage are configured; onboarding/manual drafts work independently. No outstanding founder product decision blocks this authorized V1; pricing, Pro, batch requests and approval changes are separate decisions.
