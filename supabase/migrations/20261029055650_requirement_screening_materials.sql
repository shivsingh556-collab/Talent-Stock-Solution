-- Screening material follows the requirement's existing RLS; resume scores stay unchanged.
alter table public.requirements
  add column if not exists screening_guide text not null default '',
  add column if not exists screening_materials jsonb not null default '[]'::jsonb;
alter table public.requirements add constraint requirement_screening_guide_size
  check (length(screening_guide) <= 200000);
alter table public.requirements add constraint requirement_screening_materials_shape
  check (case when jsonb_typeof(screening_materials) = 'array'
    then jsonb_array_length(screening_materials) <= 10 and octet_length(screening_materials::text) <= 10000000
    else false end);

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('requirement-assessments','requirement-assessments',false,26214400,null);

-- Requirements are shared with active employees. Originals have the same read audience.
create policy "assessment active employee read" on storage.objects for select to authenticated
  using (bucket_id = 'requirement-assessments' and (select private.is_active_user()));
create policy "assessment own upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'requirement-assessments' and (select private.is_active_user())
    and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "assessment owner or admin delete" on storage.objects for delete to authenticated
  using (bucket_id = 'requirement-assessments' and (select private.is_active_user())
    and ((storage.foldername(name))[1] = (select auth.uid())::text or (select private.is_admin())));
-- No UPDATE policy: originals use unique, immutable object paths.
