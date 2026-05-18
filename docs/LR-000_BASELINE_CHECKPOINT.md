# LR-000 — Baseline backup and protected-flow checkpoint

Status: completed checkpoint only  
Scope: documentation/baseline only. No app code changes. No migrations. No Supabase writes. No Stripe writes.

---

## Purpose

Create a safe baseline before changing wallet/payment/commercial logic.

This checkpoint records:
- hardening branch reference
- current git state
- current commit baseline
- redacted env mode/key map
- accessible payment/commercial data access status
- protected flows that must not break
- rollback expectations
- pre-patch test checklist for `LR-001` and `LR-002`

Implementation must stop here until Ben approves `LR-001`.

---

## Hardening branch

Dedicated hardening branch created/confirmed:

- `hardening/launch-readiness`

Notes:
- branch was created as a reference branch at the current commit
- working tree was left untouched
- current checked-out branch at time of checkpoint remained separate from this reference branch

---

## Git baseline

### Checked-out branch at checkpoint time
- `bot/marketing-header-align`

### Latest commit hash
- `8a62eae32e60aa2f4fbe4af6672dad00fb77a550`

### Git status snapshot
Unstaged changes present at checkpoint time:
- `BOOTSTRAP.md`
- `app/affiliate/wallet/page.tsx`
- `app/api/ad-spend/settle/route.ts`
- `app/api/run-payout/route.ts`
- `app/api/stripe-session/route.ts`
- `app/api/stripe/webhook/route.ts`

Untracked items present at checkpoint time:
- `.openclaw/`
- `.vscode/tasks.json`
- `app/api/marketing/`
- `app/shop/components/ShopHighlights.tsx`
- `docs/LAUNCH_READINESS_PATCH_PLAN.md`
- `docs/LIVE_SHARE_LINK.md`
- `docs/NETTMARK_COMMERCIAL_LINKAGE_AND_PAYMENT_INTEGRITY.md`
- `memory/.dreams/`
- `memory/2026-02-19.md`
- `memory/2026-03-23.md`
- `memory/2026-04-29.md`
- `scripts/ops/bot-safe.sh`
- `supabase/rollbacks/20260430_wallet_topup_idempotency.rollback.sql`
- `supabase/migrations/20260430_wallet_topup_idempotency.sql`
- `tsconfig.tsbuildinfo`
- `utils/marketing/`

Staged changes at checkpoint time:
- none detected

### Baseline caution
The repo is **not** clean at this checkpoint. Any later patch work should explicitly separate:
- pre-existing unrelated changes
- launch-hardening patch changes

---

## Redacted env mode/key map

### Env files found
- `.env.local`
- `.env.production`
- `.secrets/ops.env` (present but no relevant values surfaced in the scan)

### `.env.local`
- `NEXT_PUBLIC_SUPABASE_URL` → set → `https://gpaccx...supabase.co`
- `SUPABASE_URL` → set → `https://gpaccx...supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY` → set
- `STRIPE_SECRET_KEY` → **test mode** (`sk_test_...`)
- `STRIPE_WEBHOOK_SECRET` → set
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` → **test mode** (`pk_test_...`)
- `CRON_SECRET` → set

### `.env.production`
- `NEXT_PUBLIC_SUPABASE_URL` → set → `https://gpaccx...supabase.co`
- `SUPABASE_URL` → set → `https://gpaccx...supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY` → set
- `STRIPE_SECRET_KEY` → **test mode** (`sk_test_...`)
- `STRIPE_WEBHOOK_SECRET` → set
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` → **test mode** (`pk_test_...`)

### Baseline env observations
- local and production env files currently point to the **same Supabase project family** (`gpaccx...`)
- both local and production env files currently use **Stripe test-mode keys**
- this means launch cutover will require an explicit production environment switch plan, not just a wallet logic patch

---

## Payment/commercial table baseline access

### Requested tables
- `wallet_topups`
- `wallet_deductions`
- `wallet_refunds`
- `wallet_payouts`
- `wallets`
- `live_ads`
- `live_campaigns`
- `campaign_tracking_events`
- `offers`
- `affiliate_requests`
- `ad_ideas`
- `organic_posts`
- `business_profiles`
- `affiliate_profiles`
- `meta_connections`

### Access result at checkpoint time
Attempted read-only REST inspection using env-derived Supabase URL + service-role-style key from repo env files.

Observed result:
- all requested tables returned `401 Invalid API key`

### Meaning
At checkpoint time, table snapshot/reporting from repo env files was **not available** through the attempted read-only method.

### Operational note
This does **not** prove the database is unavailable overall.
It means the checkpoint process could not produce a trusted live table snapshot from the env material accessible in the repo at this moment.

### Baseline table snapshot status
- `wallet_topups` → [unavailable: 401 invalid API key]
- `wallet_deductions` → [unavailable: 401 invalid API key]
- `wallet_refunds` → [unavailable: 401 invalid API key]
- `wallet_payouts` → [unavailable: 401 invalid API key]
- `wallets` → [unavailable: 401 invalid API key]
- `live_ads` → [unavailable: 401 invalid API key]
- `live_campaigns` → [unavailable: 401 invalid API key]
- `campaign_tracking_events` → [unavailable: 401 invalid API key]
- `offers` → [unavailable: 401 invalid API key]
- `affiliate_requests` → [unavailable: 401 invalid API key]
- `ad_ideas` → [unavailable: 401 invalid API key]
- `organic_posts` → [unavailable: 401 invalid API key]
- `business_profiles` → [unavailable: 401 invalid API key]
- `affiliate_profiles` → [unavailable: 401 invalid API key]
- `meta_connections` → [unavailable: 401 invalid API key]

---

## Protected core flows (non-regression list)

These flows must remain intact through hardening unless a patch explicitly changes them and the change is approved, tested, and documented.

### Offer + approval flows
- business creates offer
- business edits offer
- affiliate requests to promote offer
- business approves affiliate request

### Paid creative + Meta flows
- affiliate submits paid ad idea
- business approves paid ad idea
- current video/image upload behavior still works
- current Meta campaign creation still works
- current Meta ad set creation still works
- current Meta creative creation still works
- `live_ads` row creation still works
- local/live status updates still work
- business approval flow remains intact

### Organic campaign flows
- affiliate submits organic post
- business approves organic post
- `live_campaigns` row creation still works

### Tracking flows
- `/go` tracking redirect works
- tracking event creation works

### Wallet + payment flows
- wallet top-up works
- refund path works
- active ad / unpaid spend refund lock works after `LR-002`
- Meta spend sync works
- ad spend settlement works
- commission payout creation works
- affiliate payout execution works

### Visibility flows
- relevant dashboards still display required commercial/wallet/campaign data

---

## Rollback expectations

### Core rollback rule
Protected flows come first. Cleanup comes later.

### Rollback expectations for later patches
- every patch must state rollback notes before approval
- every patch must preserve the ability to revert to:
  - the `hardening/launch-readiness` baseline reference, or
  - the most recent approved patch state
- duplicate money writers should be frozen/deprecated before deletion where possible
- legacy routes/tables/columns should not be deleted until replacement behavior is implemented, tested, and documented
- if a patch causes uncertainty in money movement correctness, stop and revert to last approved safe checkpoint

---

## Pre-patch test checklist for LR-001

Goal: centralize wallet math without breaking current protected flows.

### Baseline checks to run before/while implementing `LR-001`
- compare wallet numbers across all known surfaces:
  - affiliate wallet page
  - refund path
  - ad-spend settlement path
  - any payout-adjacent balance displays
- document current formula differences between:
  - `wallet_topups`
  - `wallet_deductions`
  - `wallet_refunds`
  - `wallets.balance`
  - any legacy `wallet_spends` usage
- define canonical formulas for:
  - total topups net
  - total refunded
  - total ad-spend deductions
  - available balance
  - refundable balance
  - locked balance
- confirm canonical wallet math does not break:
  - wallet top-up display
  - refund display
  - Meta spend sync guardrails
  - ad settlement calculations
- verify paid creative approval flow still works after any shared helper refactor
- verify current video/image upload behavior still works if shared wallet helpers touch adjacent imports or route behavior

### Acceptance evidence expected after `LR-001`
- one declared canonical balance source exists
- wallet-related routes agree on the same numbers
- no billable/refund decision still relies on conflicting formulas

---

## Pre-patch test checklist for LR-002

Goal: add hard refund/withdraw lock without breaking approved campaign/payment behavior.

### Test cases to define/run for `LR-002`
- refund blocked when affiliate has an active/live Meta ad
- refund blocked when ad is paused but unpaid spend still exists
- refund allowed when there is no active ad and no unpaid spend
- clear backend error codes returned for:
  - `ACTIVE_META_AD_LOCK`
  - `UNPAID_AD_SPEND_LOCK`
- wallet UI clearly explains why refund is locked
- lock logic uses the canonical balance model from `LR-001`

### Non-regression checks for `LR-002`
- standard refund path still works when allowed
- current video/image upload behavior still works
- current Meta campaign/ad set/creative creation behavior still works
- `live_ads` creation still works
- local/live status updates still work
- business approval flow remains intact

### Acceptance evidence expected after `LR-002`
- server-side refund block cannot be bypassed by UI state alone
- allowed refunds still execute normally
- active campaign + unpaid spend lock states are visible and auditable

---

## Stop condition

`LR-000` ends here.

Do **not** begin `LR-001` until Ben explicitly approves moving to the next patch.
