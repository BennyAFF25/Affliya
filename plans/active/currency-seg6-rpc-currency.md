# Currency Segment 6: atomic RPC currency

Status: implemented and locally validated. Ben approved; local only, no connections, deploy or commits. Kept at requested active path.

## Intent and evidence
Record provider currency atomically without changing commercial outcomes, amounts, balance math, locks, idempotency, authorization or return shape. Aligns with PRODUCT/BUSINESS_RULES and reliability principle 19. No UI change. Read AGENTS, DATABASE, VISION, PRODUCT_PRINCIPLES, PRODUCT, BUSINESS_RULES, MONEY_FLOW and Segment 5. Initial tree clean; HEAD 82cfc67, local main 79cd0a3; no fetch allowed.

Authoritative offline exports: /workspace/db-backups/20261015-213053-seg6/{0,1,2}.sql. Use 1 (eight-argument topup) and 2 (refund), retain both old topup overloads. Live topup/refund bodies exactly match their repository migration counterparts (20260515083000_nettmark_fee_accounting.sql and 20260511051500_wallet_refund_ledger.sql); only export formatting/dollar delimiters/default casts differ. Exports contain SECURITY DEFINER, no configured search_path, no owner/ACL statements. Preserve security/search_path; migration executor owns new functions; revoke PUBLIC/anon/authenticated and grant service_role as requested for unknown live ACLs.

Topup: signed webhook or reconciliation resolves paid Checkout/settlement, validates AUD, calls atomic insert with stripe_id conflict no-op, then wallet cache/fee ledger. Refund: existing limits/locks → Stripe refund → RPC duplicate check → topup FOR UPDATE → insert refund → embedded amount_refunded update → cache/audit. Decimal major-unit ledger amounts unchanged. No extra provider calls. Existing access-boundary issues documented in MONEY_FLOW are outside scope.

Production founder evidence supersedes Segment 5: business_activation_subsidies has zero rows and NO deployed referencing function/trigger; repository activation trigger is not live. Subsidy metadata is out of scope. Segment 2 columns and checks are confirmed deployed by user, unlike historical DATABASE wording.

## Approach / acceptance
1. Transactional additive distinctly named functions copied from live bodies; currency validation and insert metadata only. NULL forces unresolved. No replay backfill, no new row IDs, no source-topup relabelling from refund evidence.
2. New RPC first with normalized Stripe currency/provenance; only PGRST202/42883 permit old RPC retry. Old RPC and its existing direct compatibility/error paths remain unchanged. Remove redundant refund follow-up (atomic new RPC, old live RPC returns no fresh ID).
3. Mock actual private functions, compare complete old payloads, reject ambiguous/nonmissing errors without retry. Static body equality after stripping narrowly specified currency additions. Undo drops only new names.
4. Related tests, baseline/final nonincremental typecheck, network-blocked build; inspect diff.

## Risks / rollout
Migration is prepared only. Prior to deployment new RPC missing falls back and retains metadata gap. Unknown live owner/ACL: restricted service-role grant fallback per instruction. SECURITY DEFINER/search_path inherited intentionally, no hardening of originals in this scope. SQL runtime not exercised without DB. Undo returns app to old-RPC fallback without deleting metadata.

## Validation
- Installed Next 15.5.7 / TypeScript 5.9.2 verified. New Segment 6 mocked/static suite PASS: normalized provider fields, missing-function codes, no retry on other returned/thrown errors, old-RPC error preservation, unresolved inputs and replay/no follow-up. Exact definition equality against live exports after removing only signature/name, currency validation and insert additions; preserves JSON result, amount expressions, conflict handling, FOR UPDATE and balance writes. No currency UPDATE added: neither original updates a refund row; the refund source-topup update remains amount-only. Undo exact two-function allowlist and restrictive grants PASS.
- Eleven related suites PASS: currency segments 1/1b/1c/2/3/4/5/6, wallet-topup-aud, money-surface-security, affiliate-wallet-ui. The tsx CLI scripts initially hit sandbox IPC EPERM; identical files passed via node --import tsx. Segment 5 assertion descriptions updated for atomic recording; its coverage retained.
- Nonincremental typecheck baseline/final: 68 existing diagnostics, including 63 outside generated .next; no new errors. One intermediate run overlapped build regeneration and reported missing .next files; excluded from comparison, rerun after generation.
- Affected routes/new-test ESLint PASS (only existing React-version configuration warning).
- Offline build PASS with network-denying preload and nonsecret placeholders for Supabase/Stripe/STRIPE_APP_SECRET; initial build compiled but failed on missing separate STRIPE_APP_SECRET at /api/stripe-app/get-session. No credentials loaded for provider requests and no external connections permitted by preload.
- git diff --check PASS; protected ad-insights path and tsconfig.tsbuildinfo unchanged. No existing SQL changed, no migration applied, no remote configuration, deployment, commits or pushes. Only package change: new test script.
- Remaining risks: SQL runtime/production ACL and migration execution are untested (no DB allowed); old-RPC compatibility retains missing currency until migration is applied. Existing live SECURITY DEFINER without configured search_path preserved per explicit scope. Subsidies excluded per production evidence. No additional unresolved requirements.
