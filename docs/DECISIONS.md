# Nettmark evidenced decisions

> Repository evidence as of 2026-10-02. Static inspection only: live database schema, deployed configuration, external account state, and production behavior were not verified. Paths below are relative to the repository root. Historical LR reports may describe older behavior.

This is a record of explicit comments/migration statements and strongly observable implementation choices. It does not assign speculative motivations, dates of product approval, or future roadmap. Current mismatches are in the topic docs.

| Decision / implemented choice | Evidence | Consequence for changes |
|---|---|---|
| Route conversion creation through one processor | `app/api/track-event/route.ts` hands event IDs to `process-conversion`; `track.gif` proxies to track-event. | Extend the processor rather than creating another payout-creation path. |
| Require runtime campaign identity for billable ingestion | `track-event` explicitly forbids hostname/offer fallbacks for billable conversion events; `utils/tracking/campaignIdentity.ts`. | Preserve strict commercial resolution; nonbillable compatibility paths are separate. |
| Calculate wallet availability from ledger inputs | Explicit canonical-rule comment in `utils/wallet/balance.ts`; refund history is not subtracted twice. | Do not replace ledger-derived balances with cached `wallets.balance`. |
| Separate commission billing from Business/Growth subscription | Explicit comment in `utils/businessPaymentReadiness.ts`. | A subscription customer/card does not establish commission readiness. |
| Limit subscription activation gating to paid affiliate ads | Explicit opening comments and trigger changes in `20260813090000_paid_ad_only_business_subscription_gate.sql`. | Do not reintroduce request/organic subscription gating accidentally. |
| Charge transaction fee on top of principal | `calculateChargeOnTopFee` and payout/top-up metadata in `utils/feeAccounting.ts` and money routes. | Keep principal, platform fee, and Stripe processing cost distinct. |
| Separate ad-spend ledger application from Stripe transfer | `app/api/ad-spend/settle/route.ts` returns queued transfer state; batch processor is a separate scheduled handler. | Ledger success does not mean the business received reimbursement. |
| Preserve partial Meta launch and block automatic duplication | Explicit comments and guards in `/api/business/ad-ideas/launch`; Meta campaign ID is persisted during creation. | Reconcile partial external objects before retrying launch. |
| Use saved proposal data as authoritative at launch | Explicit comment and server reload in business launch handler. | Do not trust browser campaign payloads over saved proposal fields. |
| Provide preapproved organic onboarding | First-party onboarding route creates approved organic post/live campaign only for validated preapproved content. | Preserve content ownership/permission checks when extending fast paths. |
| Record stable identities while retaining compatibility | `20260512105500_stable_commercial_identity_links.sql` adds nullable IDs/backfills/triggers; payout execution still falls back to email. | Verify ID resolution and existing data before removing fallback behavior. |
| Treat recurring offers as a term commitment | Explicit UI text in `app/business/my-business/create-offer/page.tsx` plus recurring-instance/payout scheduling code. | Future unpaid cycles can be controlled separately; do not assume each cycle requires a new purchase event. |
| Associate Meta connection with Nettmark session email | Explicit callback comment: Meta name is needed, Meta email permission is not. | Preserve signed-in business association when changing OAuth scopes. |

Not established: why multiple subscription systems exist, intended attribution window across all integrations, multi-currency settlement policy, bank payout timing, production feature-flag values, external Edge Function responsibilities, or whether historical audit recommendations were fully completed. These require evidence rather than a guessed decision record.
