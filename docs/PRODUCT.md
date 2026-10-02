# Nettmark product

> Repository evidence as of 2026-10-02. Static inspection only: live database schema, deployed configuration, external account state, and production behavior were not verified. Paths below are relative to the repository root. Historical LR reports may describe older behavior.

Nettmark connects businesses publishing commission offers with affiliates promoting them through organic content or paid Meta ads. Implemented surfaces include business and affiliate dashboards, offer marketplace, creative review, tracking setup, wallets, payouts, and affiliate shops. This describes implemented behavior, not a launch-readiness claim.

## Main journeys

| Journey | Current implementation and outcome |
|---|---|
| Signup | `app/create-account/page.tsx` uses Supabase signup, upserts `profiles` with the chosen role, dispatches signup notifications, merges pre-signup Revenue subscription data when present, and redirects into role onboarding. |
| Business onboarding | `app/onboarding/for-business/page.tsx` collects offer details, destination, price, commission, participation mode, product scope, and imagery; uploads assets, directly inserts `offers`, then calls `/api/profile/onboarding-complete`. It does not establish all paid-launch prerequisites. |
| Affiliate onboarding | `app/onboarding/for-partners/page.tsx` uses `/api/onboarding/partner-programme` and `/api/onboarding/ready-first-promotion`. The server resolves Nettmark's system offer, ensures participation, verifies a preapproved organic creative, upserts `affiliate_profiles`, creates an approved post and live campaign, returns a tracking link, and marks onboarding complete. |
| Offer participation | `/api/affiliate/offers/[offerId]/start` uses `utils/approvals/enforcement.ts`: open offers allow approved participation; approval-required offers create pending requests. Business review lives in `app/business/my-business/affiliate-requests/page.tsx`. |
| Organic promotion | Affiliate promotion UI submits content for business review. `app/business/my-business/post-ideas/page.tsx` calls `/api/business/organic-campaigns` to approve and create a live campaign. Preapproved brand content can instead use `/api/affiliate/offers/[offerId]/ready-organic-promotion`. |
| Paid promotion | Affiliate promotion UI submits `ad_ideas`; business review/launch uses `/api/business/ad-ideas/launch`, which checks ownership, participation, subscription entitlement, commission payment readiness, tracking, Meta assets, timing, and funding before invoking the Meta creation handler. |
| Commission settlement | Tracked conversions create scheduled `wallet_payouts`; business payouts UI calls `/api/run-payout` to charge the business and transfer principal to the affiliate Connect account. |

## Offers and content

`app/business/my-business/create-offer/page.tsx` is a fuller offer editor than onboarding: it also stores Meta selections, site host, payout scheduling, recurring term settings, and profile/display details. `business_creatives` supports active/archive state, offer-specific or business-wide assets, paid/organic permissions, and preapproval flags. Permission to participate and permission to use a creative are separate checks.

Organic readiness returns content and a link; these routes do not prove a post was published to an external social network. Paid promotion creates actual Meta objects. Affiliate wallet funding covers ad spend; earned commissions follow the business-charge/Connect-transfer path instead of becoming spend-wallet credit.

## Limits to verify

- Onboarding and full offer creation store different fields; recurring onboarding does not populate the full recurring schedule configuration.
- Completing onboarding is not proof of tracking, saved-card, Meta, or Connect readiness.
- Preapproved organic and reviewed organic routes have different readiness checks. See [BUSINESS_RULES.md](BUSINESS_RULES.md).
- Actual subscription prices, feature-flag state, first-party offer configuration, and external publication/delivery are unknown.

Further detail: [ARCHITECTURE.md](ARCHITECTURE.md), [MONEY_FLOW.md](MONEY_FLOW.md), [TRACKING.md](TRACKING.md), [META_ADS.md](META_ADS.md).
