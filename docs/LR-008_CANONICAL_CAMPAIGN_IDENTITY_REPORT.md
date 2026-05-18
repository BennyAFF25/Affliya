# LR-008 — Canonical Campaign Identity Report

## Goal
Make runtime `campaign_id` mean exactly one thing on billable paths: a Nettmark runtime campaign UUID (`live_campaigns.id` or `live_ads.id`).

## Map / linkage grounding used
This patch was implemented against both:
- `docs/LAUNCH_READINESS_PATCH_PLAN.md`
- `docs/NETTMARK_COMMERCIAL_LINKAGE_AND_PAYMENT_INTEGRITY.md`

Key linkage rule followed from the map:
- billable event identity must not rely on `offers.id`, hostname inference, or legacy fallback masquerading as `campaign_id`
- payout creation already keys downstream on `campaign_tracking_events.campaign_id` / `wallet_payouts.source_event_id`, so bad identity at ingestion poisons the money path

## Why this patch exists
Before this patch, `campaign_id` could mean different things depending on route:
- `live_campaigns.id`
- `live_ads.id`
- `live_ads.meta_campaign_id`
- `offers.id`
- heuristic hostname-derived offer fallback

That was dangerous because billable conversion events could still arrive with ambiguous or non-runtime identity.

## What changed

### 1) Added shared runtime campaign identity resolver
Added:
- `utils/tracking/campaignIdentity.ts`

This helper now provides:
- `isUuid(...)`
- `resolveRuntimeCampaign(...)`

It resolves only canonical runtime campaign identities for:
- `live_campaigns.id`
- `live_ads.id`
- `live_ads.meta_campaign_id` → canonical `live_ads.id`

It intentionally does **not** resolve a bare `offers.id` as a valid billable runtime campaign.

### 2) Billable event ingestion is now strict in `track-event`
Updated:
- `app/api/track-event/route.ts`

For `event_type === 'conversion'`, the route now:
- requires exact runtime campaign resolution before insert
- normalizes Meta campaign ids to canonical `live_ads.id`
- rejects ambiguous billable identity with HTTP `400`
- no longer allows hostname fallback or `offers.id` masquerading as `campaign_id` on conversion events

Non-billable analytics events still keep the looser rescue behavior for now.

### 3) Legacy GIF tracking now drops invalid billable conversions
Updated:
- `app/api/track.gif/route.ts`

For conversion events, the route now:
- resolves runtime campaign identity first
- drops invalid billable conversion identity instead of inserting a poisoned event
- still returns the tracking GIF normally

### 4) Redirect path now canonicalizes legacy paid refs before site arrival
Updated:
- `app/go/[ref]/route.ts`

This was the crucial compatibility bridge.

The route now:
- canonicalizes legacy paid refs like `offer_id___affiliate_email`
- resolves them to the most relevant real `live_ads.id` for that affiliate, preferring `active/live` rows
- writes canonical `nm_camp=<runtime_uuid>` into the destination URL
- records canonical `campaign_id` in click logs

That means existing live paid ads using old offer-based tracking refs can still land on-site with a correct runtime campaign id before later billable conversion ingestion happens.

### 5) New paid Meta launches now store canonical runtime tracking links
Updated:
- `app/api/meta/callback/upload-video/route.ts`

After `live_ads` insertion, the route now updates:
- `campaign_id = inserted live_ads.id`
- `tracking_link = https://www.nettmark.com/go/<runtime_campaign_uuid>-<affiliate_email>`

This prevents perpetuating old non-canonical paid tracking links going forward.

## Verification run

### Passed
1. Diff sanity check

```bash
git diff --check -- utils/tracking/campaignIdentity.ts app/api/track-event/route.ts app/api/track.gif/route.ts 'app/go/[ref]/route.ts' app/api/meta/callback/upload-video/route.ts
```

Result:
- passed

2. Runtime identity helper smoke test

Verified live resolution behavior:
- real `meta_campaign_id` resolved to canonical `live_ads.id`
- real `live_ads.id` resolved cleanly
- bare `offers.id` returned `null`

3. Redirect canonicalization smoke test

Tested legacy paid ref:
- `c28849b1-9733-43a5-a642-b76beb4e1d91___contact@nettmark.com`

Result:
- resolved to active `live_ads.id` `89783681-a2a5-4389-a150-10fe47826651`
- redirected with:
  - `nm_camp=89783681-a2a5-4389-a150-10fe47826651`
- did **not** leave `nm_camp` as the offer id

4. Direct billable invalid-identity rejection

Local `track-event` probe with conversion + `campaign_id = offers.id` returned:
- HTTP `400`
- `INVALID_BILLABLE_CAMPAIGN_IDENTITY`

5. GIF billable invalid-identity drop

Local `track.gif` probe with conversion + `campaign_id = offers.id`:
- returned tracking GIF normally
- logged invalid billable identity drop
- did not attempt payout processing

6. Live tracking link backfill confirmation

After the redirect canonicalization path ran, confirmed live row:
- `live_ads.id = 89783681-a2a5-4389-a150-10fe47826651`
- `tracking_link = https://www.nettmark.com/go/89783681-a2a5-4389-a150-10fe47826651-contact@nettmark.com`

### Known repo noise
Targeted eslint still reports existing `any`-typing noise in the long-lived tracking and Meta upload routes. No new syntax or diff integrity issue was found in this patch.

## Acceptance criteria status
- Billable conversion events always resolve to one internal campaign row: **met**
- Meta numeric IDs are normalized before payout processing: **met**
- `campaign_id === offer_id` fallback is removed from billable paths: **met**

## Notes
- This patch intentionally preserves looser fallback behavior for non-billable analytics routes while hardening billable conversion identity.
- The redirect canonicalization bridge was necessary because real live paid ads still existed with old offer-based tracking refs in their URL flow.
- Full invalid-event quarantine remains the LR-009 follow-up.

## Files changed
- `utils/tracking/campaignIdentity.ts`
- `app/api/track-event/route.ts`
- `app/api/track.gif/route.ts`
- `app/go/[ref]/route.ts`
- `app/api/meta/callback/upload-video/route.ts`
- `docs/LR-008_CANONICAL_CAMPAIGN_IDENTITY_REPORT.md`
