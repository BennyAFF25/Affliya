# WooCommerce automatic attributed conversions

Status: completed.

Problem and product intent: founder requests plugin-free merchant connection and verified attributed orders. Aligns with VISION/PRODUCT_PRINCIPLES simplicity and reliable measured distribution. Preserve existing participation, product scope, commission and payout rules (PRODUCT/BUSINESS_RULES).

User impact and success: businesses approve their own WooCommerce key, see tracking state, and can disconnect; only their attributed paid orders enter the existing event processor exactly once. Non-Woo redirects preserve behavior.

Evidence: app/go/[ref]/route.ts emits stable affiliate UUID and runtime campaign; utils/tracking/campaignIdentity.ts resolves runtime ownership; track-event inserts major-unit amounts and lowercase currency; process-conversion enforces participation/creative approval and conversionScope. No verified safe sale refund reversal exists; recurring cancellation is not a general order reversal. Shopify branch is reference only, never merged. Database DDL is prepared from migration/code evidence, not live-verified.

Approach: self-contained guarded REST/security helpers; nonce connection and webhook lifecycle; explicit order allowlist and transactional RPC; conditional redirect UTMs; existing setup card language; mock-only tests and docs. Small common helpers should unify after Shopify #32 merges.

Trade-offs: Woo core session attribution requires enabled Order Attribution and consent. Preserve merchant UTMs when present. Coarse read_write key is necessary for webhook management; never request customer endpoints. Refund flags do not modify liabilities. Duplicate delivery never invokes processor twice; failed initial processing requires operational replay (existing pipeline limitation).

Risks: SSRF/DNS rebinding requires pinned DNS for actual transport; callbacks race with disconnect/reconnect; webhook partial creation; database migration unapplied; merchant config and Woo delivery not tested remotely. No network, DB, commits, push or deployment permitted.

Validation planned: mock lifecycle/security/PII/identity/dedup tests, relevant tracking regressions, typecheck with build-info redirected away from tsconfig.tsbuildinfo, changed-file eslint and diff checks.

## Final implementation and validation

Implementation complete. No documentation/code intent conflict was discovered beyond the documented legacy email ownership association: offers.business_id is not verified, so the optional redirect check uses a service-only relational function joining offers/business_profiles by their existing email association. MobileBusinessOverview delegates setup to the shared page panel; placing the card there supplies both mobile Launch setup and desktop readiness without a competing mobile pattern.

Files added: lib/woocommerce/{security,url,rest,orders,server,connections,webhooks}.ts; app/api/woocommerce/{connect,callback,status,disconnect,webhooks}/route.ts; components/WooCommerceConnectCard.tsx; scripts/woocommerce-integration.test.ts; docs/WOOCOMMERCE.md; migration and manual undo 20261110150000_woocommerce_integration. Files updated: app/business/my-business/page.tsx (shared setup card); app/go/[ref]/route.ts (fail-open optional UTMs); utils/auth/rateLimit.ts (isolated Woo scope); utils/offers/conversionScope.ts (Woo-source-only variation alias); package.json (test command); scripts/test-user-findings-round-3-routes.test.ts (mock optional lookup without counting a shop hit); docs/TRACKING.md (integration reference). No files deleted.

Validation:
- PASS yarn -s test:woocommerce: mock-only connection permissions/origin/rate limits, hashed nonce, ownership collision, successful/partial callback, URL/private/mixed DNS rejection, DNS failure codes, pinned REST transport shape and Basic/query fallback, HKDF/GCM/HMAC, bounded request reader, PII reduction, source-specific product eligibility, session/fallback attribution, paid gating, duplicate/refund outcomes, identity/participation rejection, disconnected/pending pings, DB/processor failure, secret cleanup after delete failure, preview-only bypass, actual mocked connected/nonconnected/failing /go and static confirm/SQL checks.
- PASS yarn -s typecheck --tsBuildInfoFile /tmp/woocommerce-typecheck.tsbuildinfo (build info explicitly redirected; tsconfig.tsbuildinfo untouched).
- PASS auth-rate-limit tests, business-offer-integrity tests and mocked test-user-findings-round-3-routes regression.
- FAIL existing tracking-metrics test: expects literal `Meta clicks (last sync)` in unchanged app/business/manage-campaigns/[campaignId]/page.tsx; test and asserted pages unchanged. Do not alter unrelated reporting UI to satisfy a stale static assertion.
- PASS eslint for all new files plus modified business page, rateLimit and conversionScope. Full changed-file lint also run: 8 pre-existing no-explicit-any errors in go route and 1 pre-existing no-require-imports error in older redirect test. Confirmed exactly the same 8/1 against HEAD via eslint stdin. No new lint failures.
- PASS git diff --check and review of requested file scope. No application build/browser/remote store/DB/SQL execution: not needed for mock-only validation and remote actions prohibited.

Remaining risks/follow-ups: live migration/schema/RLS and Woo delivery need explicitly authorized verification; consent/session metadata limitations; failed committed events require operational replay under specified duplicate rule; uncertain remote creation responses can orphan webhooks; refund liability reversal requires founder decision. See docs/WOOCOMMERCE.md. No commits, pushes, deployments, DB connections, network calls or production configuration changes performed. No dependencies added; only package test-script configuration changed.
