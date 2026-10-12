# Growth-first signup funnel — 12 Oct 2026

**Status:** In progress; new-signup-only routing and transparent trial economics.

## Intent and trade-offs
Founder explicitly wants the card-required 14-day Growth trial to be the dominant new-business path immediately after account creation, rather than after first offer publication. This intentionally changes prior Oct 5 product decision to lead with value-first offer publishing: make the price/card clear from ads onward, retain visible but secondary Free (organic only), and avoid surprise billing. Marketing claims must describe **affiliate-funded ad spend**, not "no cost" for a Growth plan.

## Current source facts
- Trial-first component `BusinessTrialFirstContinuation.tsx` currently says "Your offer is live" and only appears after onboarding. `trial-eligibility` has `Boolean(offer)` guard. Stripe checkout/choose-free are already authenticated and enforce entitlement/trial restrictions.
- `create-account` directs business straight to `/onboarding/for-business`; email confirmation return path does too. Business layout always mounts navigation; pre-existing middleware only redirects when a post-offer cookie is set.
- Existing product and marketing events already track signups, plan choice, checkout, trial start and cancellations, but do not consistently carry `src`/UTMs.
- `BusinessDemoLandingPage` contains the paid-ad copy/FAQ; `for-businesses` and `pricing` use inconsistent "free account"/deferred-price copy.
- Affiliate webhook outbox snapshots plan at delivery, not at event occurrence, and profile-updated may be bulk-triggered elsewhere. No production migrations/config changes without explicit authorization.

## Implementation order / safety
1. Copy across the four acquisition pages and signup, with Growth name/A$49/14 days/card disclosure, correct affiliate-paid Meta caveat, source attribution carried along, and accessible Free fallback.
2. New-account plan-first decision; use a marker only created during **new business signup**, inspect it through the authenticated app and trial-eligibility endpoint to avoid changing pre-existing users. Reuse existing Stripe/choose-free endpoints, reroute successful checkout (not cancelled checkout) and Free to offer onboarding; prevent app navigation skipping via focused choice screen.
3. Finish offer onboarding to dashboard after first plan choice instead of looping back to choice. Default offer currency from business country/locale (AU→AUD). 
4. Extend existing site events and webhook snapshot statuses where safe, preserving existing API authorization and financial writes; review burst source separately.
5. Explore dashboard/trial email nudges and publish latency diagnostics, without executing live emails, database migrations or Stripe purchases. 
6. Source checks + Vercel build, real screenshots if a true browser can access deployed URLs; no fabricated screenshots or unverified success claims.

## Guardrails
No Stripe prices, trial length, trial used history, entitlement subscriptions, wallet/commission writes, or historical cohort assignments change. No retroactive reroute for existing accounts. Avoid introducing false event success on user click; confirm trial via webhook/Stripe data only.
