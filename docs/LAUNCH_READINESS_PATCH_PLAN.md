# LAUNCH READINESS PATCH PLAN

Status: draft for review only  
Scope: no code changes yet — this is the master patch file to review patch-by-patch before implementation.

---

## Goal

Make the commercial + wallet + Meta ad system launch-ready, with special focus on:

1. **Ad spend is automatically and correctly deducted from the right affiliate wallet**
2. **Affiliates cannot withdraw/refund wallet funds while a Meta ad is active or while unpaid ad spend exists**
3. **Tracking, payouts, and settlement are reliable, auditable, and hard to double-charge/double-pay**
4. **The system becomes clean enough to operate without manual babysitting**

---

## What this patch plan is based on

Grounded in current code and prior mapping, especially:

- `docs/NETTMARK_COMMERCIAL_LINKAGE_AND_PAYMENT_INTEGRITY.md`
- `app/api/ad-spend/settle/route.ts`
- `app/api/meta/ad-insights/route.ts`
- `app/api/meta/sync-active-ads/route.ts`
- `app/api/stripe/refund/route.ts`
- `app/api/stripe/webhook/route.ts`
- `app/api/track-event/route.ts`
- `app/api/process-conversion/route.ts`
- `app/api/track.gif/route.ts`
- `app/api/run-payout/route.ts`
- `app/affiliate/wallet/page.tsx`
- `utils/supabase/getRefundableBalance.ts`

---

## Patch control / review workflow

Use each patch as a controlled unit of work.

### Patch statuses
- `PLANNED` — documented but not approved
- `APPROVED` — approved for implementation
- `IN PROGRESS` — currently being implemented
- `DONE` — implemented and verified
- `BLOCKED` — waiting on decision or dependency
- `DEFERRED` — intentionally postponed

### Review rule
For each implementation step, reference the patch ID directly (example: `LR-001`).
That gives us a clean audit trail and keeps discussion, approvals, and code changes aligned.

### One patch at a time rule
- Each patch must be implemented as a separate controlled unit unless Ben explicitly approves combining patches.
- Before each patch, state files expected to be touched.
- After each patch, report files touched, behavior changed, tests run, evidence, and rollback notes.
- Do not proceed to the next patch without Ben approval.

### No cleanup before hardening
- Do not delete legacy routes, tables, or columns until the replacement behavior is implemented, tested, and documented.
- Prefer freezing/deprecating duplicate money writers before deleting them.
- Cleanup happens after protected flows pass.

### Production smoke testing later
- Test mode/local tests are used first for repeatability.
- Controlled production smoke tests can happen later with tiny amounts only.
- Production money movement requires explicit Ben approval per action.
- The bot may audit/read production but must not move money, refund, payout, or alter production data without explicit approval.

### Master patch register

| Patch ID | Title | Priority | Status | Notes |
|---|---|---:|---|---|
| LR-000 | Baseline backup and protected-flow checkpoint | P0 | DONE | Checkpoint recorded in `docs/LR-000_BASELINE_CHECKPOINT.md`; stop before `LR-001` pending Ben approval |
| LR-001 | Canonical wallet balance engine | P0 | DONE | Shared wallet snapshot helper implemented; key wallet/API consumers aligned; repo-wide typecheck still blocked by pre-existing errors |
| LR-002 | Hard server-side refund/withdraw lock during active Meta ads | P0 | DONE | Shared refund-lock helper added; refund API now rejects active/unpaid states; wallet UI reflects lock state |
| LR-003 | Automated ad-spend settlement job | P0 | DONE | Cron sync now attempts per-ad settlement after spend sync, reports settled/failed counts, and preserves low-wallet auto-pause |
| LR-004 | Atomic ad-spend settlement + ledger idempotency hardening | P0 | DONE | Added settlement RPC migration + unique settlement key, and route now prefers atomic DB path with legacy fallback until migration is applied |
| LR-005 | Canonical withdrawal/refund ledger records | P0 | DONE | Refund route now records canonical `wallet_refunds` lineage via atomic DB-side recorder |
| LR-006 | Remove duplicate conversion payout creation paths | P0 | DONE | `process-conversion` is now canonical; tracking routes hand off instead of creating payouts directly |
| LR-007 | Hard approval enforcement at money boundaries | P0 | DONE | Backend approval guards now block unapproved conversion payouts and paid Meta launches |
| LR-008 | Canonical campaign identity rules | P1 | DONE | Billable paths now require canonical runtime campaign identity; legacy paid refs are canonicalized at redirect |
| LR-009 | Quarantine invalid billable events instead of guessing | P1 | DONE | Invalid billable events now land in a review queue instead of creating guessed money movement |
| LR-010 | Wallet page: locked funds, active ad state, and truthful UX | P1 | DONE | Wallet now shows refund lock truth, active-ad/unsettled-spend state, and a fuller wallet ledger including settlements and payout receipts |
| LR-011 | Business payout execution hardening | P1 | DONE | Payout execution is now idempotent at Stripe, persists payout refs, and surfaces repairable bookkeeping gaps |
| LR-012 | Stripe API/version and payment-route normalization | P2 | DONE | Commercial Stripe routes now share one API version, one metadata shape, and a documented ownership model |
| LR-013 | Introduce stable IDs alongside email snapshots | P2 | DONE | Money-critical tables now carry stable business/affiliate refs alongside email snapshots, with automatic backfill on insert/update |
| LR-014 | Legacy tracking route retirement plan | P1/P2 | DONE | `track.gif` is now a thin legacy GIF shim over `/api/track-event` and no longer owns event insertion or conversion handoff logic |
| LR-015 | Launch audit log / ops visibility for money flows | P1 | DONE | Added durable money-flow audit log plus route-level breadcrumbs for payouts, settlements, refund blocks, auto-pause, and quarantine decisions |

---

## Executive view

My recommendation is to treat this as a **launch-hardening program** with three layers:

### Layer A — must fix before launch
These directly affect money safety.

- Baseline backup and protected-flow checkpoint before any commercial hardening
- Canonical wallet balance + refundable balance logic
- Hard refund/withdraw block during active Meta ads or unpaid spend
- Automated ad-spend settlement with strong idempotency
- Remove duplicate conversion/payout processors
- Hard approval enforcement before ads/payouts can exist

### Meta upload protection across hardening phases
Any patch that touches ad ideas, campaigns, tracking, or approvals must preserve:

- current video/image upload behavior
- current Meta campaign/ad set/creative creation behavior
- `live_ads` creation
- status updates
- business approval flow

### Layer B — should fix before public scale
These affect integrity, debugging, and future safety.

- Canonical campaign identity rules
- Better ledger/audit data for ad spend and payouts
- Stable ownership model migration away from email-only joins

### Layer C — cleanup after launch if needed
- Naming/status normalization
- Legacy fallback removal
- UI polish and reporting cleanup

---

# PATCHES

---

## PATCH LR-000 — Baseline backup and protected-flow checkpoint

### Why
Before changing wallet, payment, attribution, approval, or commercial flow logic, we need a safe baseline.

This patch is about creating the operational checkpoint so later hardening work is traceable and reversible.

### Patch
Create a pre-hardening baseline and stop for Ben approval before implementing `LR-001`.

### Required actions
- create or confirm a dedicated hardening git branch
- record current git status
- record latest commit hash
- record current env mode/key map in redacted form
- snapshot or report current payment/commercial table state where access allows
- document protected core flows that must not break
- document rollback expectations
- create the pre-patch test checklist for `LR-001` and `LR-002`
- stop for Ben approval before implementing `LR-001`

### Tables to snapshot/report if available
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

### Protected core flows
- business creates/edits offer
- affiliate requests to promote
- business approves affiliate
- affiliate submits paid ad idea
- business approves paid ad idea
- video/image upload still works
- Meta ad creation still works
- `live_ads` row creation still works
- affiliate submits organic post
- business approves organic post
- `live_campaigns` row creation still works
- `/go` tracking redirect works
- tracking event creation works
- wallet top-up works
- refund path works
- active ad/unpaid spend refund lock works after `LR-002`
- Meta spend sync works
- ad spend settlement works
- commission payout creation works
- affiliate payout execution works
- dashboards still display relevant data

### Rollback expectations
- baseline branch and commit reference must exist before any hardening patch begins
- every later patch must be reversible to this checkpoint or to the prior approved patch state
- rollback notes must preserve protected flows first, cleanup second

### Pre-patch test checklist to prepare
For `LR-001`:
- verify current wallet numbers from all known surfaces before change
- compare wallet page, refund path, ad-spend path, and payout-adjacent views for consistency gaps
- define expected canonical formulas and sample cases before implementation

For `LR-002`:
- define test cases for active Meta ad refund block
- define test cases for paused-but-unpaid refund block
- define test cases for no-active-ad / no-unpaid-spend refund allow path
- define expected UI lock messages and backend error codes before implementation

### Files likely touched
- `docs/LAUNCH_READINESS_PATCH_PLAN.md`
- baseline/reference docs or notes created for checkpoint evidence

### Acceptance criteria
- hardening branch/checkpoint is documented
- current git status and latest commit hash are recorded
- redacted env mode/key map is recorded
- accessible table baseline is captured or unavailable access is explicitly noted
- protected core flows are listed and frozen as non-regression requirements
- pre-patch test checklist exists for `LR-001` and `LR-002`
- implementation stops for Ben approval before `LR-001`

### Priority
**P0 — required before any payment/commercial hardening patch**

---

## PATCH LR-001 — Canonical wallet balance engine

### Why
Right now wallet calculations are inconsistent across the app.

Examples:
- `app/api/ad-spend/settle/route.ts` uses `wallet_topups - wallet_deductions`
- `app/api/meta/ad-insights/route.ts` uses topups net of refunded amounts, then deductions
- `utils/supabase/getRefundableBalance.ts` uses `wallet_spends`, not `wallet_deductions`
- `app/affiliate/wallet/page.tsx` computes balances client-side from mixed sources
- `wallets.balance` is also being maintained separately in the webhook fallback path

This is the opposite of bulletproof. Different screens/routes can disagree about how much money is actually available.

### Patch
Create one canonical backend balance source used everywhere.

### Proposed implementation
- Add a single server-side wallet balance function/RPC/helper that returns:
  - `total_topups_net`
  - `total_refunded`
  - `total_ad_spend_deductions`
  - `available_balance`
  - `locked_balance`
  - `refundable_balance`
- Define formulas centrally
- Replace all inline balance math with this shared source
- Treat `wallets.balance` as cache only, or remove it from decision-making

### Protection requirement
This patch must preserve current wallet top-up behavior and must not break any protected Meta upload/approval/campaign creation flows while canonical wallet math is being centralized.

### Files likely touched
- `utils/supabase/getRefundableBalance.ts`
- `app/api/ad-spend/settle/route.ts`
- `app/api/meta/ad-insights/route.ts`
- `app/api/meta/sync-active-ads/route.ts`
- `app/affiliate/wallet/page.tsx`
- likely a new shared server helper and/or Supabase SQL RPC

### Acceptance criteria
- Every wallet-related route uses the same balance source
- Wallet page, refund API, ad-spend routes, and guardrails all return the same numbers
- No route uses `wallet_spends` if ad spend is actually tracked in `wallet_deductions`

### Priority
**P0 — must do before launch**

---

## PATCH LR-002 — Hard server-side refund/withdraw lock during active Meta ads

### Why
This is one of your explicit concerns, and right now it is not safe enough.

The current refund flow in `app/api/stripe/refund/route.ts`:
- checks top-up availability
- does **not** hard-block refunds if the affiliate has active Meta ads
- does **not** hard-block refunds if unpaid spend exists
- updates `wallet_topups` but does not insert a strong refund ledger row in the shown code

So today, an affiliate could potentially withdraw while campaigns are still active or while accrued spend has not been fully settled.

### Patch
Add a strict backend rule:

**No refund/withdraw is allowed if either of these is true:**
1. the affiliate has any active/live Meta ad
2. the affiliate has any unpaid ad spend (`live_ads.spend > live_ads.spend_transferred`)

### Proposed implementation
Before processing any refund:
- query `live_ads` for the affiliate
- block if any ad status is active/live
- separately block if any ad has unpaid spend > 0 even if paused
- return a clear reason code to UI

Suggested error codes:
- `ACTIVE_META_AD_LOCK`
- `UNPAID_AD_SPEND_LOCK`

### UI change
On wallet page:
- show wallet funds as either:
  - available to spend
  - locked by active campaigns / unsettled spend
  - available to refund
- disable the refund button when locked
- explain why

### Files likely touched
- `app/api/stripe/refund/route.ts`
- `app/affiliate/wallet/page.tsx`
- shared wallet guard helper

### Protection requirement
This patch must preserve current wallet refund mechanics aside from the new server-side lock, and must not break current video/image upload behavior, Meta campaign/ad set/creative creation behavior, `live_ads` creation, status updates, or business approval flow.

### Acceptance criteria
- Refund request is rejected server-side when any active Meta ad exists
- Refund request is rejected server-side when unpaid spend exists
- UI reflects lock reason before user submits

### Priority
**P0 — must do before launch**

---

## PATCH LR-003 — Automated ad-spend settlement job

### Why
You want ad spend automatically deducted from the correct affiliate wallet.

Right now the building blocks exist, but they are still too fragmented:
- `app/api/meta/ad-insights/route.ts` updates spend and auto-pauses ads when wallet is short
- `app/api/ad-spend/settle/route.ts` can settle unpaid spend into `wallet_deductions`
- `app/api/meta/sync-active-ads/route.ts` syncs active ads and may pause them

What’s missing is a single reliable automated settlement flow that keeps wallet deductions moving in step with Meta spend.

### Patch
Introduce an automated settlement cycle:

1. sync latest Meta spend
2. calculate unpaid spend per live ad
3. settle newly accrued spend into wallet ledger
4. pause ad immediately if wallet can’t cover unpaid spend
5. record result in a machine-readable audit trail

### Proposed implementation
- Extend cron flow so active ads are regularly synced and then settled automatically
- Settlement must run with strict idempotency per ad/spend checkpoint
- Settlement should be append-only from ledger perspective, even if `spend_transferred` remains as a cache/counter

### Protection requirement
This patch must preserve current video/image upload behavior, current Meta campaign/ad set/creative creation behavior, `live_ads` creation, status updates, and business approval flow while adding automation around spend sync and settlement.

### Critical rule
The source of truth for “already charged” should not rely only on mutable `spend_transferred`. We should keep:
- `live_ads.spend_transferred` as convenience state
- **plus** a unique settlement ledger record for each settled delta

### Files likely touched
- `app/api/meta/sync-active-ads/route.ts`
- `app/api/meta/ad-insights/route.ts`
- `app/api/ad-spend/settle/route.ts`
- likely new SQL constraint/index/helper for settlement idempotency

### Acceptance criteria
- Active ads accrue spend and that spend is automatically written into wallet deductions without manual trigger
- Duplicate settlement requests do not double-deduct
- Ad pauses automatically when wallet cannot cover newly accrued unpaid spend
- Settlement outcomes are auditable per ad

### Priority
**P0 — must do before launch**

---

## PATCH LR-004 — Atomic ad-spend settlement + ledger idempotency hardening

### Why
`app/api/ad-spend/settle/route.ts` is close, but still fragile:
- it updates `live_ads.spend_transferred`
- then inserts `wallet_deductions`
- if insert fails, it attempts rollback
- rollback is best-effort only

That means a bookkeeping drift is still possible if the update succeeds and the insert/rollback path partially fails.

### Patch
Make ad-spend settlement atomic at the database layer.

### Proposed implementation
Preferred:
- move settlement into a Supabase SQL function / transactional RPC
- transaction should:
  1. read current ad state
  2. calculate unpaid delta
  3. validate wallet coverage
  4. insert settlement ledger row with uniqueness protection
  5. increment `spend_transferred`
  6. return the final settlement result

### Protection requirement
This patch must harden settlement without disturbing current Meta upload behavior, ad creation behavior, `live_ads` creation, status updates, or approval-driven campaign flow.

### Add idempotency guards
Use a unique key on settlement rows, for example based on:
- `ad_id`
- settlement sequence or monotonic transferred checkpoint

### Acceptance criteria
- No possible path where `spend_transferred` advances but no matching deduction exists
- Duplicate calls return idempotent success instead of double charging
- Failed settlement leaves both ad state and wallet ledger unchanged

### Priority
**P0 — must do before launch**

---

## PATCH LR-005 — Canonical withdrawal/refund ledger records

### Why
Refund logic currently updates `wallet_topups.amount_refunded`, but the visible code does not show strong canonical insertion into `wallet_refunds` on refund execution.

For a launch-ready system, every money movement needs an auditable ledger row.

### Patch
Make refund processing write both:
- top-up refund consumption update
- canonical refund ledger row

### Proposed implementation
For every successful refund:
- insert `wallet_refunds` row with:
  - affiliate email / future affiliate id
  - source topup id
  - Stripe refund id
  - amount
  - status
  - created_at
- only then mark top-up refunded amount updated in transaction

### Acceptance criteria
- Every refund has a ledger record
- Wallet timeline can be fully built from ledger-backed records
- Refund history and balances stay in sync

### Priority
**P0 — must do before launch**

---

## PATCH LR-006 — Remove duplicate conversion payout creation paths

### Why
This is the biggest payout integrity issue in the repo.

Current overlapping payout logic exists in:
- `app/api/track-event/route.ts`
- `app/api/process-conversion/route.ts`
- `app/api/track.gif/route.ts`

That creates duplicate payout risk, duplicate business charge risk, and inconsistent logic between paid and organic flows.

### Patch
Choose exactly **one** canonical backend path that is allowed to create `wallet_payouts`.

### Recommendation
- `track-event` should only record tracking events
- `process-conversion` should become the single payout/conversion processor
- `track.gif` should become legacy tracking-only or be retired

### Proposed implementation
- remove payout creation from `track-event`
- remove payout + business deduction side effects from `track.gif`
- keep one canonical conversion processor with idempotency on `source_event_id`

### Acceptance criteria
- Exactly one route can create payout rows
- Conversion event processed twice still results in one payout set only
- No route directly mixes beacon tracking with financial side effects unless explicitly canonicalized

### Priority
**P0 — must do before launch**

---

## PATCH LR-007 — Hard approval enforcement at money boundaries

### Why
The prior audit was clear here: approval exists in the product model, but the backend does not enforce it tightly enough where money starts moving.

That means an unapproved affiliate or unapproved creative could still potentially enter campaign or payout flows through direct route usage or stale links.

### Patch
Require hard backend approval checks before:
- launching a Meta ad
- creating a live campaign
- allowing a conversion to create payout liability

### Required rules
- affiliate must have approved `affiliate_requests` row for the offer
- ad idea must be approved before Meta launch
- organic post must be approved before becoming live
- if approval is revoked, future conversions should be quarantined or rejected according to chosen business rule

### Protection requirement
Any approval hardening here must preserve current video/image upload behavior, current Meta campaign/ad set/creative creation behavior, `live_ads` creation, status updates, and the business approval flow itself.

### Files likely touched
- Meta launch route(s), especially upload/create live ad path
- creative approval routes
- conversion processor route

### Acceptance criteria
- No payout can be created for an unapproved affiliate-offer relationship
- No live Meta ad can be created from a non-approved ad idea
- No money path relies purely on client-side gating

### Priority
**P0 — must do before launch**

---

## PATCH LR-008 — Canonical campaign identity rules

### Why
`campaign_id` is currently overloaded. Depending on route, it can mean:
- `live_campaigns.id`
- `live_ads.id`
- Meta campaign id
- `offers.id`
- old fallback values

That is dangerous for attribution and debugging.

### Patch
Define one internal rule:

- internal `campaign_id` always means Nettmark runtime campaign UUID
- external Meta IDs are stored separately as metadata fields
- no billable event may depend on hostname fallback or `offer_id` masquerading as `campaign_id`

### Launch-scope version
This does **not** need the full dream schema before launch. For launch, we just need:
- strict validation in event ingestion
- clean remapping rules
- rejection/quarantine when identity cannot be resolved exactly

### Protection requirement
Campaign identity hardening must preserve current video/image upload behavior, Meta campaign/ad set/creative creation behavior, `live_ads` creation, status updates, and business approval flow.

### Acceptance criteria
- Billable conversion events always resolve to one internal campaign row
- Meta numeric IDs are normalized before payout processing
- `campaign_id === offer_id` fallback is removed from billable paths

### Priority
**P1 — should do before launch if time allows, otherwise immediately after**

---

## PATCH LR-009 — Quarantine invalid billable events instead of guessing

### Why
Current tracking code uses multiple fallbacks, including hostname inference from `offers.site_host`.
That’s acceptable for analytics rescue, but not for billable events.

### Patch
For conversion/billable events:
- if exact campaign/offer/affiliate cannot be resolved, do **not** create payout or charge
- store event in a quarantine state/table for review

### Recommendation
Keep fallback logic for non-billable analytics if you want, but **not** for commission or charge creation.

### Protection requirement
Quarantine logic must preserve current video/image upload behavior, Meta campaign/ad set/creative creation behavior, `live_ads` creation, status updates, and business approval flow while tightening billable-event handling.

### Acceptance criteria
- No payout or charge is generated from heuristic attribution alone
- Invalid billable events are preserved for investigation instead of silently guessed

### Priority
**P1 — strongly recommended before launch**

---

## PATCH LR-010 — Wallet page: locked funds, active ad state, and truthful UX

### Why
The wallet page currently lets the user think mostly in terms of balance + refundability. That is not enough once active ad-spend locking matters.

### Patch
Upgrade wallet UI to show:
- available balance
- locked by active ads / unsettled spend
- refundable now
- active Meta ad count
- clear block reason when refunding is not allowed

### Also fix
The current wallet activity view is incomplete; it mainly shows top-ups and refunds, not the full operational story.

### Add to ledger UI
- top-ups
- refunds
- ad spend settlements/deductions
- payout receipts if relevant to affiliate-facing experience

### Acceptance criteria
- Wallet UI matches backend truth
- User can immediately see why funds are not withdrawable
- Support/debug burden is reduced because the UI explains lock state

### Priority
**P1 — should do before launch**

---

## PATCH LR-011 — Business payout execution hardening

### Why
`app/api/run-payout/route.ts` is workable, but it still relies on email-linked profile lookup and updates payout status after money movement.

This is survivable, but for launch readiness we should tighten bookkeeping and retry safety.

### Patch
- Add stronger idempotency around payout execution
- Record both Stripe charge id/payment intent id and transfer id in ledger/bookkeeping
- Prevent ambiguous reruns
- Optionally move payout completion into a more transactional pattern

### Acceptance criteria
- Re-running payout job cannot double-pay the affiliate
- Every completed payout has linked Stripe references
- Bookkeeping failure after transfer is detectable and repairable

### Priority
**P1 — recommended before launch**

---

## PATCH LR-012 — Stripe API/version and payment-route normalization

### Why
Stripe versions differ across routes, and there are overlapping Stripe-related routes:
- `app/api/stripe-session/route.ts`
- `app/api/stripe/webhook/route.ts`
- `app/api/stripe/refund/route.ts`
- payout + settlement routes also use Stripe independently

This increases debugging friction and subtle inconsistency risk.

### Patch
- Standardize Stripe API version across routes
- Document which route owns each responsibility
- Keep top-up crediting only in webhook path
- Make refund, payout, and settlement flows consistent in metadata + error handling

### Acceptance criteria
- One documented ownership model per Stripe action
- Unified metadata keys across wallet/refund/payout/settlement actions
- Stripe logs become easier to trace end-to-end

### Priority
**P2 — cleanup, but worth doing during hardening if nearby files are touched**

---

## PATCH LR-013 — Introduce stable IDs alongside email snapshots

### Why
A lot of commercial ownership still depends on:
- `business_email`
- `affiliate_email`

That is fragile long term. If an email changes, financial lineage gets messy.

### Patch
Launch-safe version:
- keep current email fields as snapshots for compatibility/UI
- add stable `business_id` / `affiliate_id` references where feasible in key tables first:
  - `wallet_payouts`
  - `wallet_deductions`
  - `wallet_topups`
  - `wallet_refunds`
  - `live_ads`
  - `live_campaigns`
  - `campaign_tracking_events`

### Acceptance criteria
- New records include stable IDs in addition to emails
- Money-critical lookups can migrate off email joins over time

### Priority
**P2 — important for scale, not the first patch I’d ship**

---

## PATCH LR-014 — Legacy tracking route retirement plan

### Why
`app/api/track.gif/route.ts` currently does too much:
- tracks events
- processes conversions
- inserts payouts
- inserts deductions
- may create Stripe payment intents

That’s too much power in a legacy beacon route.

### Patch
Split responsibility cleanly:
- tracking route only ingests events
- canonical conversion processor handles money
- legacy callers are migrated or proxied safely

### Protection requirement
Any legacy-route reduction must preserve current video/image upload behavior, Meta campaign/ad set/creative creation behavior, `live_ads` creation, status updates, and business approval flow until the replacement path is implemented, tested, and documented.

### Acceptance criteria
- `track.gif` is either retired or reduced to ingestion-only behavior
- no legacy path can silently create money movements outside canonical flow

### Priority
**P1/P2 boundary — strongly tied to LR-006**

---

## PATCH LR-015 — Launch audit log / ops visibility for money flows

### Why
If you want this to be reliable in production, you need fast answers to:
- why was this refund blocked?
- why was this ad paused?
- why was this payout created?
- why was this ad spend deduction applied?

### Patch
Add structured audit fields/logging for:
- ad auto-pause
- refund blocks
- settlement success/failure
- payout creation and payout execution
- conversion quarantine decisions

### Acceptance criteria
- Each critical money event leaves enough breadcrumbs to debug without guessing
- Support/admin tools can inspect these decisions later

### Priority
**P1 — very helpful before launch**

---

# Recommended implementation order

## Phase 1 — money safety first
1. **LR-000** Baseline backup and protected-flow checkpoint
2. **LR-001** Canonical wallet balance engine
3. Test `LR-001` acceptance criteria
4. **LR-002** Hard refund lock during active ads/unpaid spend
5. Test `LR-002` acceptance criteria
6. **LR-004** Atomic settlement hardening
7. **LR-003** Automated ad-spend settlement job
8. **LR-005** Canonical refund ledger rows

## Phase 2 — payout/approval integrity
9. **LR-006** Remove duplicate payout processors
10. **LR-007** Hard approval enforcement
11. **LR-009** Quarantine invalid billable events
12. **LR-008** Canonical campaign identity rules

## Phase 3 — launch cleanup + resilience
13. **LR-010** Wallet UX truthfulness improvements
14. **LR-011** Payout execution hardening
15. **LR-015** Audit visibility
16. **LR-012** Stripe normalization
17. **LR-014** Legacy tracking retirement
18. **LR-013** Stable ID rollout

---

# My direct recommendation

If we want the shortest path to “safe enough to launch”, I would start with this exact subset:

## Launch-critical subset
- **LR-000** Baseline backup and protected-flow checkpoint
- **LR-001** Canonical wallet balance engine
- **LR-002** Refund/withdraw lock during active ads or unpaid spend
- **LR-004** Atomic/idempotent settlement hardening
- **LR-003** Automated ad-spend settlement
- **LR-005** Canonical refund ledger records
- **LR-006** Remove duplicate payout creation paths
- **LR-007** Hard approval enforcement

That set addresses your two biggest concerns directly:

### Concern 1 — ad spend automatically deducted from the correct wallet
Handled by:
- canonical balance engine
- automated settlement cycle
- atomic ledger/idempotency hardening

### Concern 2 — affiliate cannot withdraw during active Meta ad
Handled by:
- hard refund lock on server
- UI lock visibility
- unpaid-spend lock even after pause

---

# Risks if we do not patch these

## Highest risk
- affiliate withdraws funds while ads are still spending or while unpaid spend exists
- ad spend is settled twice or bookkeeping drifts after partial failure
- one conversion creates duplicate payouts from multiple processors
- unapproved affiliate/creative enters a money path
- analytics fallback creates a billable payout on guessed attribution

## Medium risk
- wallet page shows a different truth from backend routes
- support/debug becomes painful because balances appear inconsistent
- email-based identity causes future reconciliation pain

---

# Suggested working method

To keep this controlled, I recommend we implement these as reviewed patch tickets:

- one patch at a time
- one approval at a time
- each patch includes:
  - files touched
  - exact behavior change
  - tests run
  - evidence
  - rollback notes
  - acceptance checks
- do not proceed to the next patch without Ben approval

---

# Proposed next patch to do first

## Recommended first implementation patch
**LR-000 first**

Why:
- it creates the safe baseline before touching money logic
- it freezes protected flows and rollback expectations
- it gives us the checkpoint we need before changing wallet math

After `LR-000`:
1. implement **LR-001** alone
2. test `LR-001` acceptance criteria
3. implement **LR-002** alone
4. test `LR-002` acceptance criteria
5. continue to `LR-004`, `LR-003`, `LR-005`, and later patches in order

Reason:
`LR-001` changes canonical wallet math. `LR-002` depends on that math. They should not be merged into one uncontrolled patch unless explicitly approved later.

---

# Notes for future reference

This file is intentionally opinionated.

It is not the final schema redesign; it is the **practical launch-hardening roadmap**.
The main principle behind every patch is:

> no money movement should depend on guesswork, duplicate processors, or inconsistent balance math

