# Currency Segment 1c — paid wizard warning

Status: in progress. Retain at this explicitly requested active path.

Problem: Segment 1b inferred paid permission from selected brand Meta assets, hiding the non-AUD warning in Ad mode when setup was missing.

Product intent and decision: preserve proposal submission and warn early and above the final submit action. BUSINESS_RULES distinguishes participation, creative approval and launch readiness; PRODUCT describes proposal submission separately from business launch. PRODUCT_PRINCIPLES supports progressive setup. No documented prohibition on unlaunchable proposal submissions was found. No explicit persisted offer-level paid permission setting is verified (Segment 1b evidence and current offer fetch/editor); remove the inferred permission entirely. Creative-level permissions remain separate. This supersedes Segment 1b's organic-only warning suppression from missing Meta selections.

User impact / acceptance: USD, GBP and CAD offers show the warning in Ad mode even without brand Meta setup; repeat it above review submission and explain proposals may be saved but cannot launch until multi-currency arrives. Organic mode and AUD hide it. Preserve all existing validation and strict server launch/money controls.

Affected systems / approach: remove redundant offerAllowsPaid state from promote page and prop from PaidCurrencyWarning; reuse warning at wizard review footer. Add mocked rendered regression tests and package script; update obsolete Segment 1b warning expectations.

Risks and trade-offs: an unlaunchable proposal can still be submitted, as requested and consistent with documented separation. No launch, money, auth, DB or external integration logic changes. Remote state and real-user behavior remain unverified; no external calls permitted. Initial working tree clean; HEAD 345f38c, local main 79cd0a3; no remote fetch under the no-external-call rule.

Validation planned: network-blocked rendered tests and existing currency/submit regressions; typecheck with build info redirected to /tmp, lint, build; baseline comparison for existing diagnostics; final scope and whitespace checks. No commits, deploy or DB operations.

## Completion evidence

Status: completed locally; retained in `plans/active/` per explicit request. No files deleted.

- Removed inferred paid-permission state and prop; early warning uses only offer currency and explicit UI mode. No verified explicit offer-level disallow-paid setting exists to honor. No schema added.
- Reused PaidCurrencyWarning above the review footer controls. Copy explicitly permits submitting a proposal and says launch must wait for multi-currency. Submit availability, errors, retries and server validation unchanged.
- Added `scripts/currency-seg1c.test.ts` and `test:currency-seg1c` in package.json: rendered USD/GBP/CAD warning without Meta selections early and at real wizard review, Organic/AUD suppression, warning order and enabled proposal button. Updated Segment 1b's obsolete inferred-permission test.
- PASS: Segment 1c, Segment 1b, Segment 1 containment, Round 6 submit/failure/retry and Meta campaign configuration tests.
- Typecheck run with build info in /tmp: 68 pre-existing diagnostics (63 source, 5 generated Next types), exactly matching clean HEAD with equivalent generated types; zero added diagnostics after normalizing root paths and shifted line numbers.
- Lint run: 2,995 existing errors and 3 warnings, exactly matching clean HEAD by file/severity/message; zero added diagnostics.
- Build PASS. Existing Next config skips build type/lint, checked separately above. Placeholder Supabase/Stripe environment values used only for local build.
- All Node checks ran with `/tmp/currency-no-network.cjs`, blocking fetch, HTTP/HTTPS and TCP, allowing local Unix IPC. Yarn unavailable; ran package scripts with npm, no dependency changes. Installed Next 15.5.7, React 19.2.1, TypeScript 5.9.2.
- PASS `git diff --check`; final scope is three UI files, two test files, package script and this plan. No changes to strict launch/money guard, `/api/meta/ad-insights`, tsconfig.tsbuildinfo, DB/migrations, auth or production configuration. No external calls, DB operations, deploy, commits or pushes.

Review / remaining limits: live browser and actual backend submission not exercised under the offline constraint. Human checks should cover all three non-AUD currencies, review warning placement on mobile/desktop, Organic toggle and AUD, and proposal save in an authorized test environment. Existing repo-wide type/lint debt remains; no new errors identified. Production schema/configuration remains unverified and unchanged.
