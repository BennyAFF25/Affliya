# Segment E1
Status: in progress. Files only; no SQL, push, Stripe/Meta or production calls.

Problem: legacy null proposal currency is returned to cards, which label required funding AUD despite foreign offer currency. Advisory FX performs repeated lookups and may use live providers.
Product intent: explicit founder correction; preserve offer-denominated budgets, buffered AUD funding, approval controls and AUD-only default. Aligns with product reliability and clear outcomes; no commercial-model change.
Approach: share the existing offer-authoritative resolver with browser/server consumers; remove proposal AUD defaults; request-local cached-only advisory FX; add detail estimates; verify strict hold and launch paths with regression tests. Inspect settlement trigger path read-only and record limitations.
Risks: live data, cron execution and applied SQL are unverified. Historical MONEY_FLOW/DATABASE docs describe pre-E settlement; current code calls the atomic RPC. No settlement flow edits.
Validation: focused mocked currency/hold/readiness regressions, existing Segment A/C/E and batching tests, TypeScript and diff checks.

## Completed implementation and evidence
- Shared pure `utils/currency/proposalCurrency.ts` contains the existing offer-authoritative resolver; paid guards and holds use it. Null saved proposal currency inherits the offer; explicit mismatch and missing offer currency fail closed.
- Pending/readiness responses return offer currency; pending cards have no AUD fallback. Wizard offer resolution, business review/preview and affiliate details use the same resolver. Affiliate and business detail budgets show secondary buffered AUD estimates; affiliate details expose missing/mismatched currency messages. Paid-demand event currency now comes from the offer.
- Wallet reviewed: `app/affiliate/wallet/page.tsx:826` displays the recorded hold's original currency/amount and AUD remaining capacity. Those are historical money-record denominations, not a proposal-currency fallback: changing them to a mutable current offer would mislabel a historical hold. Existing FX hold metadata already originates from the offer-authoritative reservation helper, so no wallet money/display change was necessary.
- Advisory listings share request-local promises by currency. Cached quotes within the existing freshness ceiling are used without provider requests or cache writes. Distinct proposals/currencies execute in parallel via existing Promise.all. Missing/stale cache hides the estimate and blocks funding; existing currency-block messages retain precedence. Launch/resume/hold paths retain strict FX checks and live Meta checks. No listing invokes live Meta currency verification.

### Hold-sizing verdict
**No: at the starting main commit 4e7f7bd, these were not reserved as raw A$22.** `utils/wallet/launchHolds.ts:40` resolves against the offer before selecting FX RPC; `utils/paidCampaignLaunchReadiness.ts:80` uses guard-resolved offer currency for the AUD estimate and compares funding against that estimate at line 124. Upload passes `currencyGuard.campaignCurrency` into reserveLaunchHold; resume does likewise. Business launch delegates actual creation/reservation to upload after authoritative currency validation. Required amount stays in original offer units; hold and deficit comparisons use AUD. For 22 USD at 1.5 and 400bps the hold is A$34.32; for 22 GBP at 2.0 it is A$45.76. Tests cover null proposal currency, display denomination, actual RPC payload and enabled-readiness deficit. The defect was response/UI currency labelling.

### Badge speed
Segment E readiness performed `getAudRate` per proposal. Only today's cached date avoided provider calls; a fresh previous-day/weekend quote could still trigger two provider attempts, with 10-second provider timeouts, for every proposal. This is a credible regression mechanism, not a measured explanation of the reported 4.5s. New mocked test proves twelve same-currency proposals need one FX read, zero live fetches. Existing 1/14/140-card batching test passes. No browser or production latency measurement performed.

### Read-only settlement investigation
Input from founder: live_ad `271271fa-2563-4fc4-995e-7e276d0cc09e`, spend A$3, spend_transferred 0; zero deduction/settlement rows. These live facts were not independently queried. No credentials, deployed env, DB or cron logs were inspected.

Most likely code-level explanation: low spend did not reach the normal cron threshold, and a subsequent pause/archive could not flush it because the control route omits settlement authentication. Once paused it is no longer cron-eligible. This is a conditional diagnosis pending the row's actual status, funding balance and execution logs.

- `vercel.json:8` schedules sync-active-ads every five minutes; transfer batches are also scheduled every five minutes. Sync auth at `app/api/meta/sync-active-ads/route.ts:99` requires CRON_SECRET (missing: 500; wrong/missing credential: 401). Deployed secret and cron success are unknown.
- Sync selection at `app/api/meta/sync-active-ads/route.ts:242` includes only active/live/ACTIVE/LIVE with a non-null meta_ad_id. Paused/archived/ended statuses are excluded. It does not directly filter billing_state. Failed Meta insight/funding/currency lookup can prevent reaching settlement.
- `utils/adSpend/settlements.ts:15` defaults threshold to A$25 and buffer to A$10; lines 165–166 permit AD_SPEND_SETTLEMENT_THRESHOLD_AUD / AD_SPEND_WALLET_BUFFER_AUD overrides. `app/api/meta/sync-active-ads/route.ts:378` settles positive unpaid only with positive wallet+reserved subsidy and either unpaid >= threshold or remaining capacity <= buffer. With A$3 unpaid and capacity > A$13, neither default condition fires. These are trigger thresholds, not a minimum enforced by the settlement helper.
- Funding snapshot `utils/adSpend/settlements.ts:278` includes canonical wallet plus reserved activation subsidy. Subsidy selection at line 262 requires matching offer/business/affiliate and reserved/partially_consumed status. The settlement helper applies subsidy before wallet (line 427). Fully subsidy-funded settlements can have zero wallet deduction but must still produce an ad_spend_settlements row. Zero rows in both is therefore not explained by subsidy alone. Launch-fund allocation is not directly counted in this settlement snapshot; it must have become spendable wallet funding through its existing redemption path.
- Pause/archive at `app/api/meta/control-ad/route.ts:189` normally attempts settlement unless skipSettlement. Its fetch at line 198 supplies only Content-Type, but `app/api/ad-spend/settle/route.ts:12` requires bearer/x-cron-secret. Thus this internal request gets 401 when CRON_SECRET is configured (500 if absent). Control still proceeds to update status and billing_state PAUSED/ARCHIVED (lines 234/238). TERMINATED_BY_BUSINESS prevents resume at line 47; it is not a settlement-helper exclusion.
- `utils/adSpend/settlements.ts:434` calls the Segment E atomic RPC to write deduction/subsidy consumption/liability/watermark together. Unknown applied migration/RPC compatibility or errors could also leave both tables empty, intentionally rolling back together. Missing identity/currency evidence also defers settlement. Logs are needed to discriminate.
- `utils/adSpend/settlements.ts:575` transfer processing reads existing settlement rows; it cannot create the initial spend settlement. Stripe destination/platform balance thresholds occur downstream and cannot explain zero ledger rows. No settlement implementation was edited.

### Validation and delivery
Passed: `npx tsc -p . --noEmit`; final source check with `npx tsc -p . --noEmit --incremental false`; E1 regression, pending-proposals-batching, segA-atomic-holds, segC-fx-rates, segE, segD-fx-settlement and segE-commission-block scripts via `node --import tsx`; git diff --check. Mocked failures emit expected logs. Build metadata restored to original bytes.
Not run: browser/build/full repository suite, database/schema/SQL checks, production cron timings or external APIs. No SQL/config/environment changes, commit, push, deployment or real Stripe/Meta calls. Non-AUD paid launch default remains blocked.
Remaining: production evidence needed to confirm the specific ad's cause; settlement auth/paused-tail fix is separate authorised work, intentionally not implemented here.

### File inventory
- `utils/currency/proposalCurrency.ts`, `utils/currency/paidCurrencyGuard.ts`, `utils/wallet/launchHolds.ts`: one resolver and shared imports.
- `utils/fx/rates.ts`, `utils/paidCampaignLaunchReadiness.ts`: cached-only request-local advisory quotes and preserved currency-block messages.
- `app/api/affiliate/pending-paid-proposals/route.ts`, `app/api/business/ad-ideas/review-readiness/route.ts`: resolved currency responses and shared quote lookup.
- `app/affiliate/dashboard/manage-campaigns/PendingProposalRow.tsx`: remove AUD currency fallback.
- `app/affiliate/dashboard/promote/[offerId]/page.tsx`: wizard/submission currency uses resolver.
- `app/api/business/ad-ideas/[adIdeaId]/review/route.ts`, `app/api/business/ad-ideas/[adIdeaId]/launch-preview/route.ts`: offer-authoritative review/preview, mismatch rejection in preview.
- `utils/affiliate/proposalDetails.ts`, `app/affiliate/dashboard/reviews/[kind]/[proposalId]/page.tsx`, `app/business/my-business/ad-ideas/[id]/page.tsx`: detail currency/messages and AUD estimates.
- `app/api/affiliate/offers/[offerId]/paid-promotion-request/route.ts`: offer-denominated demand-event budget metadata.
- `scripts/segE1.test.ts`: regression evidence. This plan: implementation and investigation record. No files deleted.

Status: completed, with production investigation limitations above.
