# Test-user repairs
Status: In progress.
Problem: twelve reported wizard, onboarding, tracking, webhook and wallet defects.
Product intent: preserve approval-before-launch, affiliate-funded economics and private identity; make existing flows truthful and responsive. Founder explicitly requests these repairs. No pricing change, production operations, commits, or Meta writes.
Approach: inspect each current flow, repair verified defects in priority order, add additive SQL only where required, then run typecheck/lint/build and relevant regression checks.
Affected systems: proposal UI, onboarding/auth, targeting reads, marketing embeds, webhook outbox, tracking and spend reconciliation.
Risks: deployed schema/account currency and external widget licensing unknown; do not infer live state. Money and attribution changes require end-to-end evidence.
Validation: local checks and source audit; real-user and production checks remain human tasks.
