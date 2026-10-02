# Nettmark tracking and attribution

> Repository evidence as of 2026-10-02. Static inspection only: live database schema, deployed configuration, external account state, and production behavior were not verified. Paths below are relative to the repository root. Historical LR reports may describe older behavior.

## Click to conversion trace

1. `utils/tracking/buildTrackingUrl.ts` builds `https://www.nettmark.com/go/{campaignId}-{affiliateId}`. Callers frequently pass an email as `affiliateId`.
2. `app/go/[ref]/route.ts` parses `___` or the legacy last-hyphen form. It looks up `live_campaigns`, `ad_ideas`, `live_ads`, then legacy offer/affiliate mappings and direct offers. It verifies participation, blocks paused campaigns, reads `offers.website`, inserts `clicks`, and redirects with `nm_aff`, `nm_camp`, and `nm_src`. It sets a seven-day Nettmark-domain affiliate cookie and optionally updates paid tracking links.
3. The merchant-side script/pixel preserves affiliate and campaign query values and sends events to `/api/track-event`. The Nettmark-domain cookie alone does not establish merchant-domain attribution.
4. `utils/tracking/campaignIdentity.ts` resolves billable runtime IDs to `live_campaigns.id` or `live_ads.id`, including a Meta-campaign-ID mapping. `track-event` takes the offer from that runtime record; billable conversions cannot use hostname/direct-offer fallbacks. Unresolved identities go to `billable_event_quarantine`.
5. The route normalizes event types, extracts amount/currency from event data, writes `campaign_tracking_events`, and calls `/api/process-conversion` for conversions. That processor checks approval, product eligibility, commission, and creates payout rows. See [MONEY_FLOW.md](MONEY_FLOW.md).

## Installation paths

`app/business/setup-tracking/SetupTrackingContent.tsx` supplies the generic script and Shopify Customer Events pixel. The Shopify snippet subscribes to storefront events and includes checkout/line-item data needed for scoped commissions. `public/tracker.js` requires script `data-business` and `data-offer`, captures `nm_aff`/`nm_camp`, stores them in localStorage plus seven-day cookies, and infers click/cart/checkout events from URL patterns.

`/api/test-tracking`, `/api/business/tracking-readiness`, and `assertOfferTrackingReady` in `utils/approvals/enforcement.ts` are setup/readiness touchpoints. The assertion accepts nonempty `site_host` or `meta_pixel_id`, onboarding progress, or a prior `test_pixel` event. This is the implemented readiness heuristic, not proof that live purchases are correctly measured.

`/api/track.gif` is a compatibility adapter: it proxies query-string events to `/api/track-event` and returns a transparent GIF even if the handoff fails. It no longer creates payouts independently.

## Product-scoped attribution

`utils/offers/conversionScope.ts` supports `store_wide` or `specific_products`. It normalizes product/variant aliases, extracts line items, and sums matched line totals; without items it can use matching event-level product/variant IDs. Missing scope configuration/item data is quarantined or rejected; no matching products records a zero-payout processed result. Do not silently widen product scope to make conversion processing succeed.

## Known limitations

- Generic `tracker.js` supplies no sale amount or product lines; its conversion event cannot alone establish a payable sale. URL heuristics are not order verification.
- Event ingestion is public/CORS-enabled; no merchant signature verification is visible. A browser payload is not independently verified merchant revenue.
- Deduplication is per stored event and payout cycle, not a guaranteed external order ID. Repeated purchase events can receive different event IDs.
- Ingestion returns success after event insertion even when conversion handoff fails; retry/replay automation is not defined by this path.
- Redirects may resolve an `ad_ideas` ID, while strict billable identity accepts runtime rows. The Meta launch path updates local links after runtime insertion; confirm the external creative's actual URL before changing identity semantics.
- Last-hyphen parsing can misread hyphenated email suffixes. Redirect affiliate parameter versus resolved campaign affiliate needs verification; UUID and Meta-ID branches do not enforce identical affiliate matching.
- localStorage has no explicit seven-day expiry in `tracker.js`; cookies do. A single uniform attribution window cannot be claimed.

Nettmark's own marketing attribution in `utils/marketing/` and creator-referral subscription attribution in `utils/creatorReferrals.ts` are separate from merchant sale attribution.
