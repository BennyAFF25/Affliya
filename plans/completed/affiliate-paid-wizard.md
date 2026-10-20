# Affiliate paid wizard

Status: completed (file changes and local validation; live event policy remains unverified).

Problem: copy validation silently changes steps; approval is first requested during final submit and pending is thrown as an error; paid-demand notification uses the same approval guard; page mounts log promotion_started before participation. Start emits resumed events on every call; paid-demand inserts unchecked events and waits for email.

Product intent: explicit founder request separates access approval from drafting and preserves business control before proposal submission. Aligns with VISION, PRODUCT_PRINCIPLES, PRODUCT and BUSINESS_RULES. Existing create route accepts pending proposals; tighten this to approved as explicitly requested. No launch, wallet, billing or attribution changes.

User impact / success: show none/pending/approved/rejected before submission; request once; drafts survive reload per email and offer; pending can draft but cannot submit; demand has bounded waiting and visible failures.

Implementation: extend existing start route with read-only GET, deterministic primary keys for concurrent creation, existing-row checks, genuine-start events only, rolling 24h demand lookup plus deterministic event IDs chained from the preceding request (protects concurrent requests across calendar boundaries); move demand email after response. Persist all form fields and media references locally, with reselect note for browser Files. Preserve server authorization and proposal validation.

Affected systems: promote page/wizard, start, paid-demand, participation helper, create proposal approval gate. Existing product_events UUID primary key verified in 20260826000000_content_library_v1.sql; no new schema. Existing affiliate_requests id is used by current callers; live constraints unverified. Deterministic keys protect concurrent calls through these paths; other legacy writers remain outside this guarantee.

Trade-offs / risks: local drafts are device/browser specific; no File serialization. Existing events are recognized by lookup. Email remains best effort after a durable event; exactly-once email delivery cannot be guaranteed without an outbox. No SQL, push, deployment or remote config changes. Git fetch blocked because .git is read-only; local main and origin/main both dc199e9.

Validation: requested TypeScript check and node --import tsx regression tests; results below.

## Delivery evidence

Changed promote page and AdCampaignWizard for read-only access loading, explicit request/pending/rejected states, disabled final submission with explanation, manual refresh, localStorage drafts (email + offer), all form fields and current step, uploaded URLs, file re-selection notes, restored preview, discard and post-success clearing. Copy early-return now surfaces an alert and toast; disabled Next actions explain missing inputs. Existing-account session checks and notification fetches have a 20-second timeout.

Changed start route, shared participation enforcement and new promotionRequests helper for deterministic UUID creation, concurrent-conflict status reread, existing-row reuse, no resumed events, and promotion_started only after approved access with historical-event dedupe. Changed paid-demand route for pending access support, role validation, checked event persistence, rolling 24h dedupe and deferred email; the client labels the outcome Request recorded, rather than claiming email delivery. Removed unused HTML helper. Tightened ad-ideas/create participation to approved/active/accepted per the founder instruction; campaign review, budget minor units, wallet and launch behavior are preserved.

Added scripts/affiliate-paid-wizard.test.ts (mocked actual handlers/wizard: access status, concurrent inserts, email scheduling, rejection/auth failures, rolling window, checked event failures, pending proposal rejection and successful approved proposal, silent validation, click guards and request/session timeouts) and scripts/affiliate-paid-draft.test.ts (actual page persistence effects: fields, URLs, reselect, discard, clear, identity isolation, storage errors). Updated round-6 route mock with limit() for the new historical-event lookup.

Passed: node_modules/.bin/tsc -p . --noEmit; both new tests with node --import tsx; existing paid-promotion-setup-layout, meta-campaign-configuration and test-user-findings-round-4-ui tests; git diff --check. Round-6 and currency-seg1c suites fail on pre-existing currency labels (PAID LAUNCH BLOCKED and Paid launches currently support AUD), reproduced using HEAD versions of wizard/start loaded from /tmp. These unrelated currency components are unchanged. No live browser, production DB or email delivery verification; build/lint not run because targeted tests plus explicit typecheck cover this change without production credentials.

Database finding: checked-in product_events event_type checks in 20260825170500_first_party_affiliate_onboarding.sql and 20260826000000_content_library_v1.sql do not include paid_promotion_meta_requested. The old route ignored insert errors. If production uses that policy, the named demand event requires an allowlist update; this task creates/applies no SQL and now surfaces the failure instead of falsely succeeding. No DB/schema/migration/configuration changes, no push or deployment. Git fetch was blocked by read-only .git; local main/origin/main match dc199e9.

Remaining risks: production event policy must be verified; email is best effort after durable recording and has no delivery retry/outbox guarantee; unrelated legacy writers are outside deterministic-key concurrency protection; local drafts are browser/device specific. No unrelated application changes identified in final diff review.
