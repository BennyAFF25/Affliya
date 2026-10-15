# Currency Segment 5: record currency on new money records

Status: implemented and locally validated, with the documented DB-segment gaps. Kept at the explicitly requested active-plan path. Explicit Ben approval; local work only, no connections, deployment or commits.

## Problem and product intent
Segment 2 columns exist in production per current founder instruction. New ledger writes discard currency evidence. Record provenance without changing amounts, fees, balances, guard decisions, record eligibility, provider calls or settlement outcomes. This supports C1/C2/C5 of `/workspace/currency-plan.md` and documented reliability principles, without implementing their future accounting redesign or historical migration. No user-facing behavior change.

## Verified implementation and boundaries
Read AGENTS.md, DATABASE, VISION, PRODUCT_PRINCIPLES, PRODUCT, BUSINESS_RULES, MONEY_FLOW, plan instructions, registry, Money, paid guard and segment 2 migration. Local HEAD is 5ff9de0; local main is 79cd0a3; no remote fetch under the no-external-connections rule. Working tree initially clean.
Top-ups use atomic credit RPC with missing-function insert fallback; refunds use refund RPC plus fallback bookkeeping; settlement uses existing guarded multi-query writes, not the old atomic SQL function. Conversion processing creates payout liabilities and recurring instances directly. Payout execution already uses AUD Stripe charge/transfer. Activation subsidies originate inside a business-profile insert trigger; offer triggers later associate them. Historical conversions have no current application insert. Wallet is an aggregate cache.
Documentation describes segment 2 as prepared/unverified; current user explicitly confirms columns deployed. No database verification performed. Existing warnings in money-flow docs about access boundaries are outside this metadata-only scope.

## Approach and acceptance
1. Normalize strings with trim/uppercase and `^[A-Z]{3}$`; preserve unknown well-formed codes and supplied provenance (registry capability is unrelated). Missing/malformed becomes NULL/unresolved.
2. Direct inserts include metadata, with a narrowly scoped fallback to the original payload if the database rejects currency metadata. Do not retry ambiguous network failures or unrelated money-write errors. Follow-up updates are isolated, catch/log errors, and require a known newly-created row ID and NULL currency. No replay backfill.
3. Reuse existing guard resolution for campaign spend; offer currency inferred for recurring instances; payout creation inferred AUD until provider execution supplies verified evidence. Preserve existing payout currency snapshots.
4. Document SQL-created rows without a returned new ID as gaps; no function/schema changes or backfill. Leave wallets unchanged.
5. Mocked tests validate provenance, write payload equivalence, metadata failure isolation and replay behavior; run existing currency/money/round suites, nonincremental typecheck and offline build. Keep tsconfig.tsbuildinfo untouched.

## Risks and trade-offs
Metadata is deliberately best effort: missing values after an outage remain gaps until a separately authorized evidence-based repair. Follow-up writes can be lost on process death. Top-up RPC returns no row ID in repository SQL; refund RPC returns refundId only for duplicates, not new rows. Updating duplicate rows would violate no-backfill. Trigger-created subsidies need a future DB segment. Never add provider calls to fill metadata. Future per-currency accounting, atomicity and reconciliation remain separate work.

## Validation
Installed versions checked: Next 15.5.7, TypeScript 5.9.2 (Stripe and Supabase usage verified from actual imports/call sites).
- New `npm run test:currency-seg5-record-currency`: PASS, mocked Supabase and Stripe; normalization/unknown codes; each application direct-write expression; one-off/upfront/spread payouts; recurring-instance snapshots; top-up/refund payloads and unchanged RPC arguments; NULL-only follow-up; thrown/returned metadata failures; replay/no-ID gaps; actual refund provider call branches; whole settlement outcome/payload comparisons with recording disabled/enabled/rejected for wallet, subsidy, insufficient funds and claim race.
- 21 related scripts PASS: currency segments 1/1b/1c/2/3/4/5, ad-spend-stripe-init, money-surface-security, affiliate-wallet-ui, affiliate-assistant-webhook, auto-meta-spend-refresh, launch-fund, rounds 2 (2 scripts), 3 (3 scripts), 4 (2 scripts), 6.
- Extra meta-launch-payload test FAILS at line 86: stale `validateLaunchProposal(adIdea as any` text assertion. Reproduced with the unmodified HEAD upload route supplied to the same test. No unrelated test rewrite.
- `tsc --noEmit --incremental false`: 68 existing diagnostics; final 102-line diagnostic output exactly matches baseline. No new errors; tsconfig.tsbuildinfo unchanged.
- ESLint: new helper/test PASS. Affected-file lint also reports six existing errors (four explicit-any declarations in process-conversion, two prefer-const errors in upload-video). No new lint errors.
- Offline builds: both compile successfully, then fail page-data collection: initially brand-content import (unconfigured Supabase); with nonsecret placeholder Supabase variables, run-payout import (unconfigured Stripe). Real credentials were not loaded or used. Outbound networking disabled using a /tmp preload; no database or provider connections established. Full build not verified.
- `git diff --check`: PASS. Final scope reviewed; no amounts, balance logic, fees, guard decisions, record eligibility, provider calls or settlement outcomes changed. No migrations, DB functions, deployment, remote configuration, commits or backfill. Only package configuration change is the new test script.

## Per-table write-site map
| Table | Current site | Recording / gap |
|---|---|---|
| wallet_topups | app/api/stripe/webhook/route.ts:142; app/api/stripe/reconcile-topup/route.ts:65 | Direct compatibility inserts: Checkout session currency, verified. Normal credit_wallet_topup returns no row ID (20260515083000_nettmark_fee_accounting.sql:123), so no follow-up or historical lookup. Harness credit RPC at app/api/internal/money-flow-harness/route.ts:334 has the same gap. |
| wallet_refunds | app/api/stripe/refund/route.ts:161, follow-up :155 | Direct fallback: refund currency, verified. Follow-up only for explicitly new successful RPC result with refundId; WHERE id AND currency IS NULL; errors swallowed/logged. Repository RPC omits new refundId; duplicate refundId is intentionally ignored. |
| wallet_payouts | app/api/process-conversion/route.ts:118, :175 | Direct one-off/upfront/spread: AUD inferred, matching app-assumed Stripe execution currency. No Stripe object exists at creation. No historical payout upgrade during later execution. |
| wallet_deductions | utils/adSpend/settlements.ts:584 | Direct: existing guard resolution, exact Meta connection currency verified; campaign proposal/offer fallback inferred. Guards unchanged. |
| ad_spend_settlements | utils/adSpend/settlements.ts:618 | Direct: same guard-resolved campaign evidence. Current app does not call old settlement SQL RPC. |
| live_ads | app/api/meta/callback/upload-video/route.ts:1093; internal/money-flow-harness/route.ts:393 | Direct creation: existing guard resolution. Synthetic harness has no proposal/exact connection, so NULL/unresolved. Existing spend updates do not relabel rows. |
| conversions | no current application insert; process-conversion/route.ts:535 writes processed_conversions | Historical table remains untouched. Current conversions are campaign_tracking_events; no new conversions writer invented. If a DB/external writer exists, it is outside locally verified scope. Future source rule: offer currency inferred. |
| recurring_commission_instances | app/api/process-conversion/route.ts:82 | Direct: offer currency inferred. Existing instances are not relabelled. |
| business_activation_subsidies | supabase/migrations/20260818143000_business_activation_subsidies.sql:67 | Business-profile trigger creates row, returns profile, no subsidy row ID. Future DB segment must record AUD inferred (current product), or available currency evidence. No metadata added to later reserve/consume updates. |
| wallets | webhook/route.ts:159; utils/wallet/syncAffiliateWalletCache.ts:47; credit RPC | Unchanged aggregate cache; future per-currency-wallet segment. |

## Human review and remaining risks
- Normal top-up/refund RPCs and subsidy trigger remain gaps: a later explicitly authorized DB segment should return fresh row IDs or write metadata atomically. Do not force the compatibility insert path to label them.
- Payout inferred AUD describes the current application's assumed payment denomination; it does not verify a non-AUD conversion or fix offer/liability mismatches. Recurring contract currency is separately recorded from the offer. Provider verification/immutable denomination needs future accounting work.
- Best effort metadata may remain absent after rejection, outage or process death. Only explicit currency-specific database rejections retry a direct insert with its original payload. Unrelated money-write errors and ambiguous transport failures retain existing behavior; blindly retrying a lost insert response could duplicate money records.
- Unknown well-formed codes retain their supplied source. Format validation is not ISO registry membership or capability enablement; malformed/missing is NULL/unresolved.
- No production or desktop browser validation performed; deployed RPC definitions may differ from repository SQL. No DB/external connections were permitted.

## Desktop real-user checklist (no real spending)
Use a separate local mocked environment or an already-authorized Stripe test-mode environment; these checks were not executed against remote services here.
1. Open affiliate wallet and business payouts on desktop: compare balances, fee previews, history and statuses with baseline. Merely viewing these pages must not create records or relabel old rows.
2. Open and cancel top-up Checkout before submitting payment: confirm unchanged amount/fee display and no credit. A completed TEST-MODE Checkout can exercise webhook/reconcile without real money; normal RPC rows currently retain the documented metadata gap. Use local mocks to exercise compatibility inserts with session currency verified, retries, duplicate sessions and malformed currency.
3. In a local mocked conversion flow, submit one-off/upfront/spread fixtures: confirm identical payout counts, amounts, cycles and dates, payout AUD/inferred, recurring offer currency/inferred. Replay: no duplicates or relabelling.
4. Use local mocked paid launch/settlement (never launch an actual Meta campaign): verify live-ad/deduction/settlement account currency verified; insufficient funds and currency blocks unchanged; subsidy and claim-race outcomes unchanged.
5. Use mocked refunds or Stripe test-mode refunds of test payments: verify source currency and unchanged amounts; force metadata rejection and follow-up failures; verify successful money result, warning log, and old rows untouched.
6. Real production top-up/provider/DB persistence can only be verified after a separately authorized real paid Checkout. That is NOT part of this no-spend list. Production refund evidence likewise requires a real funded charge; production live-ad/spend rows require actual Meta activity. Existing production records can be read only under separate authorization, but cannot prove this new write behavior. Do not use the internal money-flow harness against production: it can move real money.

