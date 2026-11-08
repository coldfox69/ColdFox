-- ============================================================
-- ColdFox — 0006 storage buckets & policies
-- ============================================================
create or replace function public.safe_uuid(p_text text)
returns uuid
language plpgsql
immutable
as $$
begin
  return p_text::uuid;
exception when others then
  return null;
end;
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true, 2097152, array['image/png','image/jpeg','image/webp']),
  ('lead-imports', 'lead-imports', false, 10485760, array['text/csv','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']),
  ('attachments', 'attachments', false, 10485760, null)
on conflict (id) do nothing;

-- avatars: users manage their own folder
drop policy if exists avatar_public_read on storage.objects;
create policy avatar_public_read on storage.objects for select to anon, authenticated
  using (bucket_id = 'avatars');

drop policy if exists avatar_owner_write on storage.objects;
create policy avatar_owner_write on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists avatar_owner_update on storage.objects;
create policy avatar_owner_update on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists avatar_owner_delete on storage.objects;
create policy avatar_owner_delete on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- imports: organization scoped (path starts with organization uuid)
drop policy if exists imports_org_read on storage.objects;
create policy imports_org_read on storage.objects for select to authenticated
  using (bucket_id = 'lead-imports' and public.is_org_member(public.safe_uuid((storage.foldername(name))[1])));

drop policy if exists imports_org_write on storage.objects;
create policy imports_org_write on storage.objects for insert to authenticated
  with check (bucket_id = 'lead-imports' and public.is_org_member(public.safe_uuid((storage.foldername(name))[1])));

drop policy if exists imports_org_delete on storage.objects;
create policy imports_org_delete on storage.objects for delete to authenticated
  using (bucket_id = 'lead-imports' and public.has_org_role(public.safe_uuid((storage.foldername(name))[1]), array['owner','admin','member']));

-- attachments: organization scoped
drop policy if exists attachments_org_read on storage.objects;
create policy attachments_org_read on storage.objects for select to authenticated
  using (bucket_id = 'attachments' and public.is_org_member(public.safe_uuid((storage.foldername(name))[1])));

drop policy if exists attachments_org_write on storage.objects;
create policy attachments_org_write on storage.objects for insert to authenticated
  with check (bucket_id = 'attachments' and public.is_org_member(public.safe_uuid((storage.foldername(name))[1])));
