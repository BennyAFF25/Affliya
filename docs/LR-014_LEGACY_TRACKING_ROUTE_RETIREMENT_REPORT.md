# LR-014 — Legacy tracking route retirement report

## Goal
Remove money-path ownership from the legacy `track.gif` beacon route while preserving compatibility for older callers that still expect a 1×1 GIF response.

## What changed
### `app/api/track.gif/route.ts` was reduced to a legacy shim
`track.gif` no longer:
- resolves campaign identity itself
- inserts directly into `campaign_tracking_events`
- quarantines billable events itself
- calls `/api/process-conversion` itself

Instead it now:
- parses the legacy GIF query params (`t`, `aff`, `camp`, `d`)
- forwards them to `POST /api/track-event`
- always returns a 1×1 GIF for browser/beacon compatibility
- marks the response with `X-Nettmark-Legacy-Track-Gif: proxied-to-track-event`

## Ownership after LR-014
### Canonical ingestion owner
- `/api/track-event`

### Canonical money/conversion owner
- `/api/process-conversion`

### Legacy compatibility shim
- `/api/track.gif`

This means the legacy GIF endpoint no longer has direct ownership of any billable decision or money-side follow-up.

## Acceptance criteria coverage
1. **`track.gif` is either retired or reduced to ingestion-only behavior**
   - Satisfied: it is now a thin shim that proxies into the canonical ingestion route.

2. **No legacy path can silently create money movements outside canonical flow**
   - Satisfied: `track.gif` contains no direct event insert, no direct quarantine path, and no direct conversion processing/money logic.
   - Any conversion follow-up now occurs only through `/api/track-event` → `/api/process-conversion`.

## Verification
### Static verification
- `npx eslint app/api/track.gif/route.ts` ✅
- `git diff --check -- app/api/track.gif/route.ts` ✅
- grep verification confirmed `app/api/track.gif/route.ts` no longer contains:
  - `process-conversion`
  - `campaign_tracking_events`
  - `wallet_payouts`
  - `wallet_deductions`
  - Stripe payment/transfer calls
  - Supabase direct write ownership

### Runtime verification
#### Legacy page-view compatibility
Called:
- `GET http://localhost:3000/api/track.gif?t=page_view&aff=lr014-trackgif-verify@nettmark.local&d={...}`

Verified:
- response remained a valid 1×1 GIF
- event landed in `campaign_tracking_events` through the canonical path

#### Legacy invalid-conversion safety
Called:
- `GET http://localhost:3000/api/track.gif?t=conversion&aff=lr014-trackgif-quarantine@nettmark.local&camp=not-a-runtime-campaign&d={...}`

Verified:
- response remained a valid 1×1 GIF
- quarantine breadcrumb landed via canonical route handling:
  - `event_type = conversion_quarantine_decision`
  - `source_route = app/api/track-event/route.ts`
  - `reason_code = INVALID_BILLABLE_CAMPAIGN_IDENTITY`

## Notes
- LR-014 is intentionally launch-safe: legacy callers still work, but the legacy endpoint is now clearly reduced to transport compatibility only.
- Protected flows called out in the patch plan (upload behavior, Meta campaign/ad creation, `live_ads` creation, status updates, approval flow) were not touched by this patch.
