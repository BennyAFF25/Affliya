# Emergency signup profile provisioning repair — 12 October 2026

**Status:** In progress — production incident.
**Problem:** `/create-account` creates an `auth.users` account, then performs `profiles.upsert(id,email,role,username)`. October 9 `lockdown_public_sensitive_tables` grants authenticated INSERT/SELECT and only column-scoped UPDATE, so upsert attempts to update id/email/role and fails with SQLSTATE 42501. The business login read-only change should remain.

**Production evidence:** `auth.users` has six confirmed business-role accounts with no `public.profiles` row since October 9 (two Grok bot QA, one other test, three apparently real signups). All have safe role/username metadata. They also have no `brand.signed_up` webhook record; the prior successful user did. No trigger currently exists on `auth.users` to provision a profile. The existing `public.profiles` insert triggers create `business_profiles`/`affiliate_profiles`, merge pre-signup revenue server-side, and enqueue business signup webhook.

**Product alignment:** Existing VISION and PRODUCT_PRINCIPLES prioritise zero-friction onboarding; BUSINESS_RULES require private email and stable identity. No change to paid gating, roles, login workflow, pricing, or attribution.

**Fix:** Install `auth.users` AFTER INSERT security-definer trigger provisioned by the database owner; insert only valid business/affiliate roles and existing signup name, with `ON CONFLICT DO NOTHING`. Do not grant broad browser UPDATE on sensitive profile role/email. Remove client profile upsert and duplicate client revenue merge (already covered by server trigger). Protect client submit with a synchronous ref against duplicate clicks; preserve email-confirmation handling for both roles and return to onboarding. Repair missing profiles with an exact role-validated insert from Auth identities, retaining all auth users and existing profiles.

**Safety:** Trigger is additive and uses empty search_path with fully qualified table name. Never change an existing profile or infer role from arbitrary unsafe metadata outside the two signup roles. No user deletion. Database changes and deployment authorised by the explicit urgent production fix request. QA must use a genuinely new account or an approved safe test flow; do not claim successful new signup without evidence.

**Success:** No `POST /rest/v1/profiles?on_conflict=id` from signup; profile row exists immediately after Auth signup; both roles reach next onboarding stage; orphan count reaches zero; brand webhooks resume via normal business_profile trigger. Validated migration schema and actual records; no false claims about browser tests.
