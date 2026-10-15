# Currency Segment 1 containment

Status: in progress. Scope is the user's Segment 1 only; no migrations, data rewrites, external calls, deployment or commits.

Problem/product intent: Approved /workspace/currency-plan.md requires temporary AUD-only paid launches and money movement until per-currency wallets exist. This preserves existing AUD commercial behaviour and the 2.2% fee. Non-AUD and unknown currency must fail closed; NULL proposal currency uses the offer. No campaign is paused by this guard.

Evidence: docs/{VISION,PRODUCT_PRINCIPLES,PRODUCT,BUSINESS_RULES,ARCHITECTURE,DATABASE,MONEY_FLOW,META_ADS,UI_DESIGN_SYSTEM}.md; launch, upload-video, paidCampaignLaunchReadiness, launchFund and adSpend/settlements. Existing launch validator rejects NULL saved currency despite migration fallback commentary; resolve in memory only. Upload resolves latest exact business/Page/account pair. Live ads have proposal/offer linkage but no durable connection snapshot: selected offer pair is the available evidence; historical identity remains a review limitation, not a schema change.

Approach: one shared server guard; readiness and launch boundaries; reservation and settlement/reimbursement checks before mutations; consistent blocked copy and AUD defaults; mocked tests and required checks. Settlement skips preserve watermarks and reimbursement state for retry. No auth changes.

Risks: incomplete historical schema/connection provenance; no production evidence requested. Preserve NULL legacy fallback. Changes to offer account selection cannot establish historical account identity; later segments must snapshot it.

Validation: pending. Run typecheck with build info redirected to /tmp, lint, mocked tests, and build without external network. Review diff and prohibited paths. Keep this plan at the user-requested active path.

## Completion evidence

Status: Segment 1 code completed; retained in `active/` as explicitly requested. Human production review remains below. No later segment started.

- Shared `utils/currency/paidCurrencyGuard.ts` evaluates AUD/AUD only and resolves the same exact business/Page/account pair and newest connection as upload-video. Missing/blank/unsupported values fail closed; only absent/NULL proposal snapshots use offers.currency. No account-currency default.
- Business launch and upload gate before Meta work; funding readiness carries `currencyBlock`, business review and affiliate proposal badges consume it. Funding cache identity includes proposal currency. Legacy NULL proposal validation fallback is in memory only.
- Launch Fund reserve/redemption, wallet spend deduction and reimbursement use the shared guard. Skipped settlement logs reason and preserves deductions/watermarks; reimbursement retains retryable transfer_blocked with reason, never transfer_paid. Existing retry/idempotency mechanics remain intact. No guard action pauses a campaign.
- Wizard warns early; blocked copy is consistent; create/edit/onboarding default AUD. Explicit foreign offer choices and saved data remain unchanged.
- `scripts/currency-seg1-containment.test.ts` covers supported/unsupported/unknown currencies, legacy fallback, readiness/reservation, settlement/reimbursement skips, and authenticated launch copy using mocked clients. Added `test:currency-seg1` package script. Updated Round 6 assertions for the requested replacement copy.

Validation:
- `npm run test:currency-seg1`, `test:meta-campaign-configuration`, `test:test-user-findings-round-6`, `test:pending-proposals-batching`, and `test:launch-fund`: PASS. Network denied by a temporary Node preload; mocks only.
- `npm run typecheck -- --tsBuildInfoFile /tmp/currency-seg1.tsbuildinfo`: existing failures, no new error locations/codes compared with clean HEAD extracted under /tmp. Non-generated error count 63 vs baseline 65. Removed the already-invalid redundant requireMedia option in touched review readiness (launch validator already requires media).
- `npm run lint`: existing 2,995 errors, zero added versus clean HEAD (file/rule/message comparison). No repository lint-policy changes.
- `npm run build`: PASS with dummy Supabase/Stripe environment values, NEXT_TELEMETRY_DISABLED=1 and a temporary preload rejecting HTTP/HTTPS/fetch/TCP while allowing Unix IPC. Initial attempts failed on missing Supabase/Stripe configuration before placeholders were supplied. Build skips type/lint by existing Next configuration; those checks are separately reported above.
- `git diff --check`: PASS. No changes to tsconfig.tsbuildinfo, /api/meta/ad-insights, migrations or database configuration. No external API calls, database operations, data rewrites, deployment, commits or pushes. package.json configuration change is test wiring only. No files deleted.
- HEAD and local main both 79cd0a3; no remote fetch under the external-call restriction.

Human review: Live ads have no original connection/account snapshot. Guard uses the exact currently resolved offer Page/account connection, not an arbitrary/latest business connection, but cannot prove historical identity after an offer account change. Review historical account changes and the named USD/GBP proposals without rewriting them. Later approved segments must address immutable historical linkage. Deployed schema/account data and actual live-user effects were not accessed or verified. Other known financial atomicity and commission-currency issues are outside this segment.
