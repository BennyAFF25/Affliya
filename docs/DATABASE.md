# Nettmark database map

> Repository evidence as of 2026-10-02. Static inspection only: live database schema, deployed configuration, external account state, and production behavior were not verified. Paths below are relative to the repository root. Historical LR reports may describe older behavior.

## Evidence hierarchy

Never infer the live schema from this document. `types/supabase.ts` explicitly contains an example table and empty functions/views/enums. `ops/schema/schema_public_20260212.txt` is a historical relation listing, not current complete DDL. Local migrations incrementally alter existing commercial tables; their original definitions are not all present. Code queries establish fields the application expects, not that those fields exist or have safe policies in production.

## Core entities expected by current code

| Entities | Role and links visible in code |
|---|---|
| `profiles`, `business_profiles`, `affiliate_profiles` | Signup identity/role; business email and Stripe customer/account data; affiliate `user_id`, email, and Connect readiness. |
| `offers` | Offer ID anchors destination, business ownership, commission percentage, scope, participation, recurring settings, and Meta selections. |
| `affiliate_requests` | Offer/affiliate/business participation and approval state. |
| `business_creatives`, `ad_ideas`, `organic_posts` | Brand library and affiliate submissions; creative references and review state. |
| `live_ads`, `live_campaigns` | Paid Meta runtime rows versus organic runtime rows. Paid rows link offer, idea, Meta IDs, spend, and settlement watermark. |
| `meta_connections` | Business email plus ad account/page combination and saved access token; callback upserts on `business_email,ad_account_id,page_id`. |
| `clicks`, `campaign_tracking_events`, `processed_conversions` | Redirect click records; event ledger; conversion-processing markers. Commission creation uses the event ledger, not the historical `conversions` table. |
| `wallet_topups`, `wallet_deductions`, `wallet_refunds`, `wallets` | Spend funding ledger, deductions, refund audit, and cached wallet information. |
| `wallet_payouts`, `recurring_commission_instances` | Scheduled affiliate commission liabilities and recurring-term state. |
| `business_onboarding_progress` | Tracking readiness evidence queried by approval utilities; complete definition not located in local migrations. |

## Migration landmarks

- `20260430_wallet_topup_idempotency.sql`: `credit_wallet_topup` and Stripe-ID deduplication.
- `20260511051500_wallet_refund_ledger.sql`: refund ID uniqueness and `record_wallet_refund`.
- `20260511054500_canonical_conversion_payouts.sql`: source-event/cycle uniqueness and payout RPC. Current conversion route creates payouts in TypeScript instead; do not assume RPC semantics are active.
- `20260511060000_ad_spend_settlement_atomic.sql`: settlement RPC and deduction key. Current `utils/adSpend/settlements.ts` applies multiple queries rather than calling that RPC.
- `20260512105500_stable_commercial_identity_links.sql`: nullable `business_id`/`affiliate_user_id` foreign keys, backfills, and `resolve_commercial_identity_links` triggers across commercial ledgers/runtime records. Email fallback remains in application code.
- `20260511070000_billable_event_quarantine.sql`, `20260512123000_money_flow_audit_log.sql`: rejected billable identities and operational audit history.
- `20260513124500_offer_conversion_scope.sql`: eligible product/variant scope.
- `20260515020500_ad_spend_settlements_ledger.sql`, `20260515083000_nettmark_fee_accounting.sql`: reimbursement queue and platform fee ledger.
- July subscription migrations: entitlements, Stripe event history, gate settings/events. `20260813090000_paid_ad_only_business_subscription_gate.sql` removes request/organic activation gates and retains paid idea approval/live-ad insertion triggers.
- July creator-referral and launch-fund migrations: separate creator subscription commission ledger and affiliate promotional allocations/transactions.
- August recurring-term, activation-subsidy, first-party onboarding, and content-library migrations extend offers and promotion paths; content migration creates `product_events`.
- September participation mode, submission-view tracking, storage policies, and legacy billing-entry migration refine access and onboarding.

## Verification required

Confirm applied migration history, full DDL, policies/grants, storage buckets, core indexes, and actual foreign keys before database work. Browser inserts depend on RLS; service-role handlers and `SECURITY DEFINER` triggers need separate authorization review. Nullable stable links do not eliminate email joins. Source-event payout uniqueness protects one event's cycles; it does not by itself deduplicate repeated external orders recorded as different events.

No migration or live database change was performed to create these docs.
