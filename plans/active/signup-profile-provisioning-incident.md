# Emergency signup profile provisioning repair — 12 October 2026

**Status:** Database repair complete, frontend deployed; authenticated browser E2E validation pending.
**Problem:** `/create-account` creates an `auth.users` account, then performs `profiles.upsert(id,email,role,username)`. October 9 `lockdown_public_sensitive_tables` grants authenticated INSERT/SELECT and only column-scoped UPDATE, so upsert attempts to update id/email/role and fails with SQLSTATE 42501. The business login read-only change should remain.

**Production evidence:** `auth.users` has six confirmed business-role accounts with no `public.profiles` row since October 9 (two Grok bot QA, one other test, three apparently real signups). All have safe role/username metadata. They also have no `brand.signed_up` webhook record; the prior successful user did. No trigger currently exists on `auth.users` to provision a profile. The existing `public.profiles` insert triggers create `business_profiles`/`affiliate_profiles`, merge pre-signup revenue server-side, and enqueue business signup webhook.

**Product alignment:** Existing VISION and PRODUCT_PRINCIPLES prioritise zero-friction onboarding; BUSINESS_RULES require private email and stable identity. No change to paid gating, roles, login workflow, pricing, or attribution.

**Fix:** Install `auth.users` AFTER INSERT security-definer trigger provisioned by the database owner; insert only valid business/affiliate roles and existing signup name, with `ON CONFLICT DO NOTHING`. Do not grant broad browser UPDATE on sensitive profile role/email. Remove client profile upsert and duplicate client revenue merge (already covered by server trigger). Protect client submit with a synchronous ref against duplicate clicks; preserve email-confirmation handling for both roles and return to onboarding. Repair missing profiles with an exact role-validated insert from Auth identities, retaining all auth users and existing profiles.

**Safety:** Trigger is additive and uses empty search_path with fully qualified table name. Never change an existing profile or infer role from arbitrary unsafe metadata outside the two signup roles. No user deletion. Database changes and deployment authorised by the explicit urgent production fix request. QA must use a genuinely new account or an approved safe test flow; do not claim successful new signup without evidence.

**Success:** No `POST /rest/v1/profiles?on_conflict=id` from signup; profile row exists immediately after Auth signup; both roles reach next onboarding stage; orphan count reaches zero; brand webhooks resume via normal business_profile trigger. Validated migration schema and actual records; no false claims about browser tests.

## Deployment and verification
- Migration `provision_auth_signup_profiles` applied on production Supabase. Two initial attempts failed atomically: creating a function inside protected `auth` schema, then a globally unique business-name collision. Final migration succeeded with `public.nettmark_provision_signup_profile` (empty search_path, definer, revoked EXECUTE) and business names stored in `business_profiles.business_name`, not `profiles.username`.
- Production query: zero `auth.users` missing `profiles`, all six affected businesses have profile and business-profile names; no users were deleted or roles changed in existing profiles.
- Normal `business_profiles` trigger enqueued the six missing `brand.signed_up` webhook records; 10 total and all marked `delivered` at the audit time.
- Grants remained limited: authenticated has no table-wide `profiles` UPDATE nor role/email UPDATE; onboarding_completed UPDATE retained.
- Frontend `app/create-account/page.tsx`: one synchronous ref lock per sign-up, Auth trigger profile read-back, no client upsert or restricted pre-signup revenue reads/updates; both roles with missing sessions show email confirmation. `app/auth-redirect/page.tsx` now read-only, same as business login.
- `scripts/signup-profile-provisioning.test.ts` added and registered. Static source checks passed. Vercel production build status READY. Script itself not executed. No actual fresh signed-out browser signup executed: container cannot reach DNS; need Grok QA to confirm Step 2 for both roles.
- Avoid testing by creating arbitrary Auth users via admin SQL, as this would not exercise frontend signUp/session/redirect behaviour.
