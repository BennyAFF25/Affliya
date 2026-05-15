# LR-012 — Stripe API/version and payment-route normalization report

## Goal
Reduce Stripe drift across money routes by standardizing API version usage, clarifying route ownership, and making Stripe metadata easier to trace end-to-end.

## What changed
### 1) Unified commercial Stripe client versioning
Added shared helper in `utils/stripe.ts`:
- `STRIPE_API_VERSION`
- `createStripeClient(...)`
- `buildStripeMetadata(...)`
- `buildNettmarkStripeMetadata(...)`

Commercial Stripe routes now use the shared client instead of hard-coded per-file versions.

### 2) Normalized metadata across top-up / refund / payout / settlement flows
Standardized around:
- `nettmark_platform=nettmark`
- `nettmark_action=<wallet_topup|wallet_refund|wallet_payout|ad_spend_settlement>`

Applied to:
- top-up checkout session creation
- wallet refund creation
- payout payment-intent creation
- payout affiliate transfer creation
- ad-spend settlement transfer creation
- legacy checkout/payment-intent creators that still exist in the codebase

### 3) Clarified route ownership
Current ownership model:
- **`/api/stripe/create-topup-session`** → creates wallet top-up checkout sessions only
- **`/api/stripe/webhook`** → sole owner of wallet top-up crediting / ledger mutation
- **`/api/stripe-session` GET** → client confirmation/session lookup only
- **`/api/stripe-session` POST** → deprecated/no-op webhook-style endpoint; explicitly logs that wallet crediting belongs to `/api/stripe/webhook`
- **`/api/stripe/refund`** → wallet refund execution + ledger recording
- **`/api/run-payout`** → business charge + affiliate payout transfer
- **`/api/ad-spend/settle`** → ad-spend settlement bookkeeping + business transfer

### 4) Tightened settlement transfer safety
`app/api/ad-spend/settle/route.ts` now sends Stripe transfers with a stable idempotency key derived from settlement identity/amount, reducing ambiguity on retries.

## Acceptance criteria coverage
1. **One documented ownership model per Stripe action**
   - Covered in the ownership model above and reflected in route behavior/logging.

2. **Unified metadata keys across wallet/refund/payout/settlement actions**
   - Verified with shared helper + live Stripe test-mode retrievals.

3. **Stripe logs become easier to trace end-to-end**
   - Verified by retrieving created Stripe test objects and confirming shared `nettmark_*` metadata.

## Verification evidence
### Static verification
- `rg -n "apiVersion:" app/api/stripe app/api/stripe-session app/api/run-payout/route.ts app/api/ad-spend/settle/route.ts utils/stripe.ts`
  - only `utils/stripe.ts` now owns the shared commercial Stripe API version in this route set
- `npx eslint utils/stripe.ts app/api/stripe/create-topup-session/route.ts app/api/stripe/webhook/route.ts app/api/stripe/refund/route.ts app/api/run-payout/route.ts app/api/ad-spend/settle/route.ts app/api/stripe-session/route.ts app/api/stripe/create-customer/route.ts app/api/stripe/create-setup-intent/route.ts app/api/stripe/create-account/route.ts app/api/stripe/check-account/route.ts app/api/stripe/create-business-account-link/route.ts app/api/stripe/affiliates/create-account/route.ts app/api/stripe/affiliates/check-account/route.ts app/api/stripe/test-account/route.ts app/api/stripe/create-payment-intent/route.ts app/api/stripe/create-checkout-session/route.ts app/api/stripe/check-customer-card/route.ts` ✅
- `git diff --check` on LR-012 touched files ✅

### Live Stripe test-mode verification
#### Wallet top-up session metadata
Created a real Stripe test checkout session through `/api/stripe/create-topup-session` and retrieved it from Stripe.
Verified metadata included:
- `nettmark_action=wallet_topup`
- `nettmark_platform=nettmark`
- `affiliate_email`
- `topup_amount`

Session id used:
- `cs_test_a1NZ2r1rztSjN2CSP4Wiujs8odfbJU86za5f5rIsksSRq90pKAR7IgYgFm`

#### Wallet payout metadata
Created a synthetic pending payout in the linked Supabase test project, executed `/api/run-payout`, and retrieved the resulting Stripe objects.
Verified both the payment intent and transfer carried normalized metadata.

Objects created:
- Payment intent: `pi_3TW4hdADLjZ5ptV013ngN2KL`
- Transfer: `tr_1TW4heADLjZ5ptV0mIcAeRIQ`

Verified metadata included:
- `nettmark_action=wallet_payout`
- `nettmark_platform=nettmark`
- `wallet_payout_id`
- `business_email`
- `affiliate_email`
- `offer_id`
- `stripe_role`

## Notes
- `stripe-app/*` revenue/subscription routes remain separate because they use `STRIPE_APP_SECRET` rather than the commercial wallet/payout Stripe secret.
- LR-012 intentionally focused on commercial wallet / refund / payout / settlement flows and their overlapping route ownership.
