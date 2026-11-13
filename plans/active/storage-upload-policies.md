# Storage upload policies

- **Status:** Blocked on exact undo baseline; client fixes, forward migration and static validation finished; local-only. No network/database access, commits, pushes or deployment. Keep this plan at the explicitly requested active path.
- **Problem:** Founder-provided production inventory includes permissive bucket writes and an authenticated INSERT policy covering every bucket.
- **Product intent:** Restrict user writes to their own auth UID directory while preserving public creative delivery, marketplace submissions and business content management. Aligns with docs/VISION.md, PRODUCT_PRINCIPLES.md, PRODUCT.md and BUSINESS_RULES.md; no commercial or visual changes.
- **Existing implementation:** Browser writes in business/affiliate settings, my-shop, onboarding, create-offer, publish-creatives and promote/[offerId]. Content-library POST/PATCH/DELETE routes use service role, verify session and business ownership, and retain email-prefixed server paths. Meta upload-video consumes public URLs and validates the bucket marker, not a videos/ first folder. utils/contentLibrary.ts extracts the complete bucket-relative path, preserving nested folders.
- **Approach:** Audit all Storage mutations; prefix missing client paths, reuse filename sanitation; prepare transactional migration/undo; add AST-based static regression coverage; run offline test, nonincremental typecheck and touched-file lint.
- **Success criteria:** All client upload paths begin with authenticated UID; seven buckets each have INSERT/UPDATE/DELETE ownership policies; existing SELECT policies untouched; undo restores exact original definitions.
- **Trade-offs:** offer-logos uploads use upsert:false in both uploaders, so no SELECT policy is needed or added. Service-role routes bypass RLS and remain unchanged.
- **Risks:** Existing unprefixed organic/ad/offer objects and email-prefixed creative objects retain public reads but user overwrite/delete is blocked. No existing browser update/remove/move calls found. New uploads use new paths; service-role content-library cleanup still works. Roll out client code before applying SQL. Undo deliberately restores broad access. Supplied UPDATE/DELETE roles and predicates are abbreviated; exact undo evidence requested, not database-verified. Historical business-creatives migration retains broad legacy access; this explicit request supersedes that choice.
- **Validation:** `node --import tsx scripts/storage-upload-policies.test.ts` passes (13 client uploads; 3 service-role mutations; 21 new policies; 20 restored names). `tsc --noEmit --incremental false` passes, zero errors. Touched-file ESLint has zero new errors: 34 existing diagnostics vs 35 at HEAD (25 promote, 9 create-offer); helper/test/onboarding clean. `git diff --check` passes. Exact undo predicates cannot be validated from the abbreviated inventory: undo is explicitly draft and guarded by a transaction-aborting exception before any policy changes. No live RLS verification permitted. Local main inspected without fetching; working branch fix/storage-upload-policies, initially clean. Installed Next 15.5.7, Supabase JS 2.56.0, TS 5.9.2.


## Call-site audit

Paths below omit timestamp/filename details where unchanged; UID is always the authenticated user ID, never an offer/business ID.

| File | Bucket | Old path | New path |
| --- | --- | --- | --- |
| app/business/settings/page.tsx | avatars | UID/business-avatar-timestamp.ext | unchanged |
| app/affiliate/settings/page.tsx | avatars | UID/affiliate-avatar-timestamp.ext | unchanged |
| app/affiliate/dashboard/my-shop/page.tsx (offer image) | shop-images | UID/offerId-timestamp.ext | unchanged |
| app/affiliate/dashboard/my-shop/page.tsx (hero) | shop-images | UID/hero-timestamp.ext | unchanged |
| app/onboarding/for-business/page.tsx (logo) | offer-logos | UID/logos/timestamp_safeName | unchanged; sanitizer extracted to utils/storageFileName.ts |
| app/onboarding/for-business/page.tsx (products) | profile-images | UID/products/timestamp_safeName | unchanged |
| app/business/my-business/create-offer/page.tsx (logo) | offer-logos | timestamp_rawName | UID/logos/timestamp_safeName |
| app/business/my-business/create-offer/page.tsx (products) | profile-images | timestamp_rawName | UID/products/timestamp_safeName |
| app/business/my-business/publish-creatives/page.tsx (helper; asset and thumbnail callers) | business-creatives | UID/assets-or-thumbnails/timestamp-name.ext | unchanged |
| app/affiliate/dashboard/promote/[offerId]/page.tsx (organic) | organic-posts | timestamp-safeName | UID/timestamp-safeName |
| app/affiliate/dashboard/promote/[offerId]/page.tsx (paid video) | ad-ideas-assets | videos/timestamp-safeName | UID/videos/timestamp-safeName |
| app/affiliate/dashboard/promote/[offerId]/page.tsx (paid image) | ad-ideas-assets | images/timestamp-safeName | UID/images/timestamp-safeName |
| app/affiliate/dashboard/promote/[offerId]/page.tsx (thumbnail) | ad-ideas-assets | thumbnails/timestamp-thumb-safeName | UID/thumbnails/timestamp-thumb-safeName |
| app/api/business/content-library/route.ts POST | business-creatives | sanitized-email/assets-or-thumbnails/generated-name | unchanged; service role |
| app/api/business/content-library/[id]/route.ts PATCH | business-creatives | sanitized-email/assets-or-thumbnails/generated-name | unchanged; service role |
| app/api/business/content-library/[id]/route.ts PATCH/DELETE cleanup | business-creatives | stored path or complete path extracted from public URL | unchanged; service-role remove |

Repository-wide searches included Storage calls, bucket constants/variables and all upload/update/remove/move/copy operations. Edit-offer pages contain no Storage mutations. Meta upload-video consumes URLs rather than writing Supabase Storage. No client Storage update/remove/move/copy found. Existing SELECT policies and bucket public flags are not altered. No production data migration, configuration change or DB execution occurred. No tsconfig.tsbuildinfo change.

### Remaining evidence

The provided inventory omits exact roles/USING/WITH CHECK for several ad-ideas-assets, profile-images and shop-images update/delete policies (including whether UPDATE WITH CHECK is NULL or explicit). The ad-ideas-assets INSERT role is also not explicit. Requested exact pg_policies rows; the draft undo contains provisional equivalents, not a claim of exact restoration. Replace these using authoritative supplied evidence and remove the guard only once verified. Do not apply forward migration until a verified rollback is available.

## Staging verification (Cody, 2026-11-12)
- Applied to staging qcwmrovdadlhgzweulee. Added "offer-logos own-prefix read" (authenticated, own prefix only) because offer-logos had no SELECT policy, which blocked users updating/deleting even their own logos.
- 70 simulated checks (7 buckets x 10, Storage-API-style role + JWT sub, rolled back) all pass: own upload/overwrite/delete allowed; upload into another user's prefix or unprefixed path denied; overwrite/delete/move-into another user's file denied; anon upload denied; public reads unchanged.
- Undo round trip restored the identical 26-policy set; migration re-applied. Backup/test: /workspace/db-backups/20261112-staging-storage-own-prefix/.
