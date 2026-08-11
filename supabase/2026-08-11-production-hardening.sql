-- TSS Resume Intelligence production hardening
-- Safe to run after schema.sql and previous migrations.

-- Requirement delete (creator or admin)
drop policy if exists "requirements creator or admin delete" on public.requirements;
create policy "requirements creator or admin delete"
on public.requirements for delete to authenticated
using (created_by = auth.uid() or public.is_admin());

-- Resume version management
drop policy if exists "resumes owner or admin update" on public.resume_versions;
create policy "resumes owner or admin update"
on public.resume_versions for update to authenticated
using (
  exists(select 1 from public.candidates c where c.id = candidate_id and (c.uploaded_by = auth.uid() or public.is_admin()))
)
with check (
  exists(select 1 from public.candidates c where c.id = candidate_id and (c.uploaded_by = auth.uid() or public.is_admin()))
);

drop policy if exists "resumes owner or admin delete" on public.resume_versions;
create policy "resumes owner or admin delete"
on public.resume_versions for delete to authenticated
using (
  exists(select 1 from public.candidates c where c.id = candidate_id and (c.uploaded_by = auth.uid() or public.is_admin()))
);

-- Screening delete for owner/admin
drop policy if exists "screenings owner or admin delete" on public.screenings;
create policy "screenings owner or admin delete"
on public.screenings for delete to authenticated
using (screened_by = auth.uid() or public.is_admin());

-- Matches delete/update remain restricted to authenticated users with candidate ownership/admin.
drop policy if exists "matches authenticated write" on public.candidate_requirement_matches;
drop policy if exists "matches owner or admin insert" on public.candidate_requirement_matches;
create policy "matches owner or admin insert"
on public.candidate_requirement_matches for insert to authenticated
with check (
  exists(select 1 from public.candidates c where c.id = candidate_id and (c.uploaded_by = auth.uid() or public.is_admin()))
);
drop policy if exists "matches owner or admin update" on public.candidate_requirement_matches;
create policy "matches owner or admin update"
on public.candidate_requirement_matches for update to authenticated
using (
  exists(select 1 from public.candidates c where c.id = candidate_id and (c.uploaded_by = auth.uid() or public.is_admin()))
)
with check (
  exists(select 1 from public.candidates c where c.id = candidate_id and (c.uploaded_by = auth.uid() or public.is_admin()))
);
drop policy if exists "matches owner or admin delete" on public.candidate_requirement_matches;
create policy "matches owner or admin delete"
on public.candidate_requirement_matches for delete to authenticated
using (
  exists(select 1 from public.candidates c where c.id = candidate_id and (c.uploaded_by = auth.uid() or public.is_admin()))
);

-- Candidate notes update/delete
drop policy if exists "notes owner or admin update" on public.candidate_notes;
create policy "notes owner or admin update"
on public.candidate_notes for update to authenticated
using (created_by = auth.uid() or public.is_admin())
with check (created_by = auth.uid() or public.is_admin());
drop policy if exists "notes owner or admin delete" on public.candidate_notes;
create policy "notes owner or admin delete"
on public.candidate_notes for delete to authenticated
using (created_by = auth.uid() or public.is_admin());

-- Interview delete
drop policy if exists "interviews authenticated delete" on public.interviews;
create policy "interviews authenticated delete"
on public.interviews for delete to authenticated
using (created_by = auth.uid() or public.is_admin());

-- Admin can manage profiles. Recruiters can read themselves only (existing policy).
drop policy if exists "profiles admin insert" on public.profiles;
create policy "profiles admin insert"
on public.profiles for insert to authenticated
with check (public.is_admin());
drop policy if exists "profiles admin delete" on public.profiles;
create policy "profiles admin delete"
on public.profiles for delete to authenticated
using (public.is_admin());

-- Private candidate-resumes storage policies.
drop policy if exists "TSS resume upload" on storage.objects;
create policy "TSS resume upload"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'candidate-resumes'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "TSS resume read" on storage.objects;
create policy "TSS resume read"
on storage.objects for select to authenticated
using (
  bucket_id = 'candidate-resumes'
  and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
);

drop policy if exists "TSS resume update" on storage.objects;
create policy "TSS resume update"
on storage.objects for update to authenticated
using (
  bucket_id = 'candidate-resumes'
  and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
)
with check (
  bucket_id = 'candidate-resumes'
  and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
);

drop policy if exists "TSS resume delete" on storage.objects;
create policy "TSS resume delete"
on storage.objects for delete to authenticated
using (
  bucket_id = 'candidate-resumes'
  and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
);
