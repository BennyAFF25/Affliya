-- Content Library uploads are performed by authenticated browser clients.
-- Give the public bucket an explicit read policy and authenticated write policies.
-- The application now writes new objects under <auth.uid()>/assets or thumbnails.
-- Broad authenticated write access is retained for legacy email-prefixed objects so
-- existing assets can still be maintained; new object ownership is enforced by app paths.

drop policy if exists "Allow authenticated access" on storage.objects;
drop policy if exists "Business creatives authenticated insert" on storage.objects;
drop policy if exists "Business creatives owner update" on storage.objects;
drop policy if exists "Business creatives owner delete" on storage.objects;
drop policy if exists "Business creatives authenticated update" on storage.objects;
drop policy if exists "Business creatives authenticated delete" on storage.objects;

create policy "Business creatives public read"
on storage.objects
for select
to public
using (bucket_id = 'business-creatives');

create policy "Business creatives authenticated insert"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'business-creatives');

create policy "Business creatives authenticated update"
on storage.objects
for update
to authenticated
using (bucket_id = 'business-creatives')
with check (bucket_id = 'business-creatives');

create policy "Business creatives authenticated delete"
on storage.objects
for delete
to authenticated
using (bucket_id = 'business-creatives');
