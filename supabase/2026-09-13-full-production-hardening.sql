-- Todo AI full production hardening.
-- Enforces per-recruiter candidate data at the database boundary and removes
-- browser-callable access to privileged queue worker functions.

-- Company requirements remain visible to all active authenticated employees,
-- but only their creator or an administrator may modify them.
drop policy if exists "requirements authenticated update" on public.requirements;
create policy "requirements creator or admin update"
on public.requirements for update to authenticated
using (created_by = (select auth.uid()) or public.is_admin())
with check (created_by = (select auth.uid()) or public.is_admin());

drop policy if exists "candidates authenticated read" on public.candidates;
create policy "candidates owner or admin read"
on public.candidates for select to authenticated
using (uploaded_by = (select auth.uid()) or public.is_admin());

drop policy if exists "resumes authenticated read" on public.resume_versions;
create policy "resumes owner or admin read"
on public.resume_versions for select to authenticated
using (
  uploaded_by = (select auth.uid())
  or exists (
    select 1 from public.candidates c
    where c.id = candidate_id
      and (c.uploaded_by = (select auth.uid()) or public.is_admin())
  )
);

drop policy if exists "matches authenticated read" on public.candidate_requirement_matches;
create policy "matches owner or admin read"
on public.candidate_requirement_matches for select to authenticated
using (
  exists (
    select 1 from public.candidates c
    where c.id = candidate_id
      and (c.uploaded_by = (select auth.uid()) or public.is_admin())
  )
);

drop policy if exists "TSS resume authenticated read" on storage.objects;
drop policy if exists "TSS resume read" on storage.objects;
create policy "TSS resume owner or admin read"
on storage.objects for select to authenticated
using (
  bucket_id = 'candidate-resumes'
  and ((storage.foldername(name))[1] = (select auth.uid())::text or public.is_admin())
);

-- Worker-only tables get explicit service-role policies. Browsers retain no
-- access, while the database advisor can distinguish this intentional boundary.
drop policy if exists "automation settings service role" on public.automation_settings;
create policy "automation settings service role" on public.automation_settings
for all to service_role using (true) with check (true);
drop policy if exists "requirement email events service role" on public.requirement_email_events;
create policy "requirement email events service role" on public.requirement_email_events
for all to service_role using (true) with check (true);
drop policy if exists "interview update email events service role" on public.interview_update_email_events;
create policy "interview update email events service role" on public.interview_update_email_events
for all to service_role using (true) with check (true);

alter function public.set_interview_email_events_updated_at() set search_path = '';
alter function public.normalize_requirement_profile_key() set search_path = '';

-- These functions are automation/trigger internals, not public browser RPCs.
revoke execute on function public.claim_due_interview_email_events_with_key(text,integer) from public, anon, authenticated;
revoke execute on function public.claim_due_interview_update_email_events_with_key(text,integer) from public, anon, authenticated;
revoke execute on function public.claim_due_requirement_email_events_with_key(text,integer) from public, anon, authenticated;
revoke execute on function public.mark_interview_email_event_with_key(text,uuid,text,text) from public, anon, authenticated;
revoke execute on function public.mark_interview_update_email_event_with_key(text,uuid,text,text) from public, anon, authenticated;
revoke execute on function public.mark_requirement_email_event_with_key(text,uuid,text,text) from public, anon, authenticated;
revoke execute on function public.prepare_interview_email_queue_with_key(text) from public, anon, authenticated;
revoke execute on function public.queue_requirement_email_event(uuid,text,text,jsonb) from public, anon, authenticated;
revoke execute on function public.release_stale_claimed_requirement_email_events() from public, anon, authenticated;
revoke execute on function public.requeue_failed_requirement_email_events() from public, anon, authenticated;
revoke execute on function public.resolve_recruiter_email(text) from public, anon, authenticated;
revoke execute on function public.sync_client_owner_to_requirements() from public, anon, authenticated;
revoke execute on function public.trg_queue_requirement_email_alerts() from public, anon, authenticated;

grant execute on function public.claim_due_interview_email_events_with_key(text,integer) to service_role;
grant execute on function public.claim_due_interview_update_email_events_with_key(text,integer) to service_role;
grant execute on function public.claim_due_requirement_email_events_with_key(text,integer) to service_role;
grant execute on function public.mark_interview_email_event_with_key(text,uuid,text,text) to service_role;
grant execute on function public.mark_interview_update_email_event_with_key(text,uuid,text,text) to service_role;
grant execute on function public.mark_requirement_email_event_with_key(text,uuid,text,text) to service_role;
grant execute on function public.prepare_interview_email_queue_with_key(text) to service_role;
grant execute on function public.queue_requirement_email_event(uuid,text,text,jsonb) to service_role;
grant execute on function public.release_stale_claimed_requirement_email_events() to service_role;
grant execute on function public.requeue_failed_requirement_email_events() to service_role;
grant execute on function public.resolve_recruiter_email(text) to service_role;
grant execute on function public.sync_client_owner_to_requirements() to service_role;
grant execute on function public.trg_queue_requirement_email_alerts() to service_role;

-- Consolidate interview event access and avoid per-row auth re-evaluation.
drop policy if exists "email events owner or admin read" on public.interview_email_events;
drop policy if exists "email events owner or admin write" on public.interview_email_events;
create policy "email events owner or admin select" on public.interview_email_events
for select to authenticated using (
  exists (select 1 from public.interviews i where i.id = interview_id and (i.created_by = (select auth.uid()) or public.is_admin()))
);
create policy "email events owner or admin insert" on public.interview_email_events
for insert to authenticated with check (
  exists (select 1 from public.interviews i where i.id = interview_id and (i.created_by = (select auth.uid()) or public.is_admin()))
);
create policy "email events owner or admin update" on public.interview_email_events
for update to authenticated using (
  exists (select 1 from public.interviews i where i.id = interview_id and (i.created_by = (select auth.uid()) or public.is_admin()))
) with check (
  exists (select 1 from public.interviews i where i.id = interview_id and (i.created_by = (select auth.uid()) or public.is_admin()))
);
create policy "email events owner or admin delete" on public.interview_email_events
for delete to authenticated using (
  exists (select 1 from public.interviews i where i.id = interview_id and (i.created_by = (select auth.uid()) or public.is_admin()))
);

create index if not exists email_jd_intake_approved_by_idx on public.email_jd_intake(approved_by);
create index if not exists interview_update_email_events_interview_id_idx on public.interview_update_email_events(interview_id);
create index if not exists requirements_submitted_by_idx on public.requirements(submitted_by);
create index if not exists screenings_submitted_by_idx on public.screenings(submitted_by);
