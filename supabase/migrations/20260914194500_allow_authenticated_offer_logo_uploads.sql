do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Authenticated upload for offer logos'
  ) then
    create policy "Authenticated upload for offer logos"
      on storage.objects
      for insert
      to authenticated
      with check (bucket_id = 'offer-logos');
  end if;
end
$$;
