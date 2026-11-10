# Shopify QA follow-ups

Status: completed.

Problem: My Business infers tracking from site_host, treats empty/unresolved verification as success, and persists that inference to onboarding. The route reuses the deliberately permissive launch heuristic. Disconnect/uninstall already clear Shopify pixel status. No pixel_connected field or writer exists in this checkout.

Product intent / alignment: accurate setup outcomes and informed disconnect, consistent with VISION, PRODUCT_PRINCIPLES, PRODUCT and BUSINESS_RULES; preserve publication and approval semantics. No commercial or attribution-rule change.

Approach: opt-in display mode on tracking-readiness; unchanged default for post-ideas review caller and unchanged assertOfferTrackingReady/offerReadiness and all gate callers. Display accepts a business-owned connected active Shopify pixel, or real non-Shopify merchant telemetry in the last seven days. Website, Meta ID, synthetic setup test and onboarding flags alone are insufficient. Seven days is a conservative evidence freshness window, not a live installation guarantee. Shopify telemetry must never keep a disconnected pixel ready. Stop checklist-generated tracking onboarding writes rather than clearing historical flags used by gates. Refresh display on card lifecycle changes and window focus. MobileBusinessOverview renders navigation; checklist is shared parent JSX.

Trade-offs / risks: manual installations without recent traffic need an actual merchant event; existing schema has no independently verified manual-installation state. Recent telemetry is evidence, not ongoing reachability proof. Legacy gates remain permissive intentionally. No DB/network connections, migration/config changes, commits, pushes or deployments. Preserve extension TOML, generated dist and tsconfig.tsbuildinfo.

Success: inactive/disconnected/uninstalled Shopify no longer ready from stale hints; active connected Shopify ready; genuine independent manual telemetry remains ready; cancel disconnect has no side effects.

Validation: offline Shopify suites, readiness/tracking suites, new regression checks, typecheck with build info redirected to /tmp, changed-file ESLint. Live behavior unverified by instruction.


## Validation results

- Passed `yarn test:shopify-pixel` and `yarn test:shopify-integration` (mock only).
- Passed offer-readiness, business-subscription-gate, offer-meta-readiness via `node --import tsx`. Yarn's tsx CLI was blocked by sandbox IPC EPERM; the Node import runner avoids that local listener.
- Passed new `scripts/tracking-display-readiness.test.ts` (Shopify status matrix, ownership/multiple stores, independent manual telemetry, synthetic/stale evidence, errors, legacy-gate compatibility) and `scripts/shopify-disconnect-confirm.test.ts` (open/cancel/dismiss/confirm, refresh including reload failure).
- Passed `yarn -s typecheck --tsBuildInfoFile /tmp/nettmark-shopify-qa.tsbuildinfo` with zero errors, preserving repository build info; changed-file ESLint passed (existing React version settings warning only); `git diff --check` passed.
- Existing `scripts/tracking-metrics.test.ts` fails on the old expected inline `Meta clicks (last sync)` label in untouched campaign-detail files. Existing `scripts/test-user-findings-round-3-readiness.test.ts` fails at line 43: missing notices after current currency lookup defers settlement. Tests and their affected campaign/route files are identical to HEAD; these failures are outside this change.
- Installed versions inspected: Next 15.5.7, React 19.2.1, Headless UI 2.2.7, TypeScript 5.9.2.

## Delivery / boundaries

Changed display helper, opt-in status route, shared My Business checklist/offer badges, Shopify card dialog, SHOPIFY docs and two regression tests. MobileBusinessOverview inspected; its setup view delegates to parent JSX, so no duplicate mobile implementation is needed. No application gate caller or assertion changed: post-ideas default status request, offerReadiness, organic-campaign approval, paid-promotion-request, review-readiness, launch and Meta upload-video retain their existing heuristic. No stored historical flags are cleared. Checklist no longer fabricates onboarding tracking flags from a host string; no publication gate is added.

No database/migration/configuration changes, DB/network connections, commits, pushes or deployments. Existing extension TOML uid change and generated dist are preserved, repository tsconfig.tsbuildinfo unchanged. Live UI/Shopify behavior not exercised under the offline-only constraint. Remaining limitation: manual status depends on recent telemetry rather than a verified installation registry.
