# LR-007 — Hard Approval Enforcement at Money Boundaries Report

## Goal
Require hard backend approval checks before money movement or paid Meta launch can happen.

## Why this patch exists
Before this patch:
- `app/api/process-conversion/route.ts` could create payout liability without verifying the affiliate was actually approved for the offer
- `app/api/meta/callback/upload-video/route.ts` could launch a paid Meta ad and create `live_ads` even if the ad idea approval state was not enforced server-side
- approval safety depended too heavily on UI flow instead of backend truth

## What changed

### 1) Added shared backend approval guards
Added:
- `utils/approvals/enforcement.ts`

This helper now provides:
- `assertAffiliateOfferApproved(...)`
- `assertAdIdeaLaunchApproved(...)`

These guards verify:
- approved `affiliate_requests` row exists for the `offer_id + affiliate_email` pair
- paid Meta launch also requires the exact `ad_ideas` row to be `status='approved'`
- ad idea context matches the requested offer + affiliate pair

### 2) Conversion payout path now enforces affiliate approval
Updated:
- `app/api/process-conversion/route.ts`

The route now:
- blocks payout creation with HTTP `403` when the affiliate-offer relationship is not approved
- keeps `processed_conversions` as a post-success marker instead of setting it before validation
- adds defense-in-depth for paid Meta conversions by re-checking the underlying `ad_ideas` approval state when the campaign resolves from `live_ads`

### 3) Paid Meta launch path now enforces server-side approval
Updated:
- `app/api/meta/callback/upload-video/route.ts`

The route now:
- requires `adIdeaId`, `offerId`, and resolved `affiliateEmail` approval context before launch
- blocks launch if the affiliate is not approved for the offer
- blocks launch if the ad idea is not approved
- blocks launch if the ad idea context does not match the offer/affiliate pair

This means `live_ads` creation can no longer rely on client-side approval flow alone.

## Verification run

### Passed
1. Diff sanity check

```bash
git diff --check -- utils/approvals/enforcement.ts app/api/process-conversion/route.ts app/api/meta/callback/upload-video/route.ts
```

Result:
- passed

2. Local `process-conversion` smoke test

Executed with a non-existent event id.

Result:
- handler loaded successfully
- returned HTTP `404`
- response: `{"error":"event_not_found"}`

3. Local Meta upload approval-context smoke test

Executed with `offerId` + `adIdeaId` but no affiliate approval context.

Result:
- handler loaded successfully
- returned HTTP `400`
- response: `{"success":false,"error":"Missing required approval context for Meta launch"}`

### Known repo noise
Targeted eslint still reports the repo's existing `any`-typing noise in these long-lived routes, especially `upload-video`. No new syntax or diff integrity issue was found in this patch.

## Acceptance criteria status
- No payout can be created for an unapproved affiliate-offer relationship: **met**
- No live Meta ad can be created from a non-approved ad idea: **met**
- No money path relies purely on client-side gating: **met** for conversion payout creation and paid Meta launch

## Notes
- This patch intentionally hardens the real paid Meta launch boundary (`/api/meta/callback/upload-video`) rather than relying on UI approval state.
- Organic post approval still flows through the business review UI and `live_campaigns` creation path; this patch focused on launch-scope money boundaries and paid Meta launch enforcement first.

## Files changed
- `utils/approvals/enforcement.ts`
- `app/api/process-conversion/route.ts`
- `app/api/meta/callback/upload-video/route.ts`
- `docs/LR-007_APPROVAL_ENFORCEMENT_REPORT.md`
