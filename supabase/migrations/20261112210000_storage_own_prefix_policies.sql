-- Applied to STAGING 2026-11-12. Deploy the UID-prefixed client uploaders before applying to production.
-- Existing SELECT policies and public bucket settings are unchanged.
-- offer-logos had no SELECT policy (public URLs still served). Without one, users could not
-- update/delete even their own logos, so an own-prefix SELECT for authenticated is added; it lists only the caller's own files.
BEGIN;

DROP POLICY IF EXISTS "Allow ALL uploads to organic-posts" ON storage.objects;
DROP POLICY IF EXISTS "Allow uploads to organic-posts" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload organic-posts" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated upload to organic-posts" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated upload to ad-ideas-assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated upload for offer logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated upload for profile images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload ad assets" ON storage.objects;
DROP POLICY IF EXISTS "Business creatives authenticated insert" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own avatars" ON storage.objects;
DROP POLICY IF EXISTS "shop images write" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated update to ad-ideas-assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update profile images" ON storage.objects;
DROP POLICY IF EXISTS "Business creatives authenticated update" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatars" ON storage.objects;
DROP POLICY IF EXISTS "shop images update" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated delete from ad-ideas-assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete profile images" ON storage.objects;
DROP POLICY IF EXISTS "Business creatives authenticated delete" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own avatars" ON storage.objects;

CREATE POLICY "organic-posts own-prefix insert" ON storage.objects
AS PERMISSIVE FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'organic-posts' AND (storage.foldername(name))[1] = (select auth.uid())::text);

CREATE POLICY "organic-posts own-prefix update" ON storage.objects
AS PERMISSIVE FOR UPDATE TO authenticated
USING (bucket_id = 'organic-posts' AND (storage.foldername(name))[1] = (select auth.uid())::text)
WITH CHECK (bucket_id = 'organic-posts' AND (storage.foldername(name))[1] = (select auth.uid())::text);

CREATE POLICY "organic-posts own-prefix delete" ON storage.objects
AS PERMISSIVE FOR DELETE TO authenticated
USING (bucket_id = 'organic-posts' AND (storage.foldername(name))[1] = (select auth.uid())::text);

CREATE POLICY "ad-ideas-assets own-prefix insert" ON storage.objects
AS PERMISSIVE FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'ad-ideas-assets' AND (storage.foldername(name))[1] = (select auth.uid())::text);

CREATE POLICY "ad-ideas-assets own-prefix update" ON storage.objects
AS PERMISSIVE FOR UPDATE TO authenticated
USING (bucket_id = 'ad-ideas-assets' AND (storage.foldername(name))[1] = (select auth.uid())::text)
WITH CHECK (bucket_id = 'ad-ideas-assets' AND (storage.foldername(name))[1] = (select auth.uid())::text);

CREATE POLICY "ad-ideas-assets own-prefix delete" ON storage.objects
AS PERMISSIVE FOR DELETE TO authenticated
USING (bucket_id = 'ad-ideas-assets' AND (storage.foldername(name))[1] = (select auth.uid())::text);

CREATE POLICY "offer-logos own-prefix insert" ON storage.objects
AS PERMISSIVE FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'offer-logos' AND (storage.foldername(name))[1] = (select auth.uid())::text);

CREATE POLICY "offer-logos own-prefix update" ON storage.objects
AS PERMISSIVE FOR UPDATE TO authenticated
USING (bucket_id = 'offer-logos' AND (storage.foldername(name))[1] = (select auth.uid())::text)
WITH CHECK (bucket_id = 'offer-logos' AND (storage.foldername(name))[1] = (select auth.uid())::text);

CREATE POLICY "offer-logos own-prefix delete" ON storage.objects
AS PERMISSIVE FOR DELETE TO authenticated
USING (bucket_id = 'offer-logos' AND (storage.foldername(name))[1] = (select auth.uid())::text);

CREATE POLICY "profile-images own-prefix insert" ON storage.objects
AS PERMISSIVE FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'profile-images' AND (storage.foldername(name))[1] = (select auth.uid())::text);

CREATE POLICY "profile-images own-prefix update" ON storage.objects
AS PERMISSIVE FOR UPDATE TO authenticated
USING (bucket_id = 'profile-images' AND (storage.foldername(name))[1] = (select auth.uid())::text)
WITH CHECK (bucket_id = 'profile-images' AND (storage.foldername(name))[1] = (select auth.uid())::text);

CREATE POLICY "profile-images own-prefix delete" ON storage.objects
AS PERMISSIVE FOR DELETE TO authenticated
USING (bucket_id = 'profile-images' AND (storage.foldername(name))[1] = (select auth.uid())::text);

CREATE POLICY "business-creatives own-prefix insert" ON storage.objects
AS PERMISSIVE FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'business-creatives' AND (storage.foldername(name))[1] = (select auth.uid())::text);

CREATE POLICY "business-creatives own-prefix update" ON storage.objects
AS PERMISSIVE FOR UPDATE TO authenticated
USING (bucket_id = 'business-creatives' AND (storage.foldername(name))[1] = (select auth.uid())::text)
WITH CHECK (bucket_id = 'business-creatives' AND (storage.foldername(name))[1] = (select auth.uid())::text);

CREATE POLICY "business-creatives own-prefix delete" ON storage.objects
AS PERMISSIVE FOR DELETE TO authenticated
USING (bucket_id = 'business-creatives' AND (storage.foldername(name))[1] = (select auth.uid())::text);

CREATE POLICY "avatars own-prefix insert" ON storage.objects
AS PERMISSIVE FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = (select auth.uid())::text);

CREATE POLICY "avatars own-prefix update" ON storage.objects
AS PERMISSIVE FOR UPDATE TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = (select auth.uid())::text)
WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = (select auth.uid())::text);

CREATE POLICY "avatars own-prefix delete" ON storage.objects
AS PERMISSIVE FOR DELETE TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = (select auth.uid())::text);

CREATE POLICY "shop-images own-prefix insert" ON storage.objects
AS PERMISSIVE FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'shop-images' AND (storage.foldername(name))[1] = (select auth.uid())::text);

CREATE POLICY "shop-images own-prefix update" ON storage.objects
AS PERMISSIVE FOR UPDATE TO authenticated
USING (bucket_id = 'shop-images' AND (storage.foldername(name))[1] = (select auth.uid())::text)
WITH CHECK (bucket_id = 'shop-images' AND (storage.foldername(name))[1] = (select auth.uid())::text);

CREATE POLICY "shop-images own-prefix delete" ON storage.objects
AS PERMISSIVE FOR DELETE TO authenticated
USING (bucket_id = 'shop-images' AND (storage.foldername(name))[1] = (select auth.uid())::text);

CREATE POLICY "offer-logos own-prefix read" ON storage.objects
AS PERMISSIVE FOR SELECT TO authenticated
USING (bucket_id = 'offer-logos' AND (storage.foldername(name))[1] = (select auth.uid())::text);

COMMIT;
