-- TODO AI security hardening (2026-09-06)
-- Safe to re-run. Apply in Supabase SQL Editor after previous migrations.

-- 1) Recruiters must not read other recruiters' match rows (candidate UUID leak).
drop policy if exists "matches authenticated read" on public.candidate_requirement_matches;
drop policy if exists "matches owner or admin read" on public.candidate_requirement_matches;
create policy "matches owner or admin read"
on public.candidate_requirement_matches
for select
to authenticated
using (
  exists (
    select 1
    from public.candidates c
    where c.id = candidate_id
      and (c.uploaded_by = auth.uid() or public.is_admin())
  )
);

-- 2) Admin profile updates must also pass WITH CHECK (blocks role self-escalation).
drop policy if exists "profiles admin update" on public.profiles;
create policy "profiles admin update"
on public.profiles
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- 3) Re-assert: only admins permanently delete candidates.
drop policy if exists "candidates owner or admin delete" on public.candidates;
drop policy if exists "candidates authenticated delete" on public.candidates;
drop policy if exists "candidates admin delete" on public.candidates;
create policy "candidates admin delete"
on public.candidates
for delete
to authenticated
using (public.is_admin());

-- 4) Anon should not have table DML. Auth stays RLS-gated.
revoke all on all tables in schema public from anon;
grant usage on schema public to anon, authenticated;
