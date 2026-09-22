-- TODO AI: daily calling records, admin client-submission files and monthly recruiter reporting.

create table if not exists public.candidate_call_logs (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  requirement_id uuid not null references public.requirements(id) on delete cascade,
  screening_id uuid references public.screenings(id) on delete set null,
  recruiter_id uuid not null references public.profiles(id),
  call_outcome text not null check (call_outcome in ('Interested in Job Change','Not Interested','No Answer','Call Back Later','Wrong Number','Already Placed','Other')),
  call_notes text,
  next_follow_up_at timestamptz,
  called_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_candidate_call_logs_recruiter_called on public.candidate_call_logs(recruiter_id,called_at desc);
create index if not exists idx_candidate_call_logs_candidate_requirement on public.candidate_call_logs(candidate_id,requirement_id,called_at desc);
create index if not exists idx_candidate_call_logs_requirement on public.candidate_call_logs(requirement_id);
create index if not exists idx_candidate_call_logs_screening on public.candidate_call_logs(screening_id) where screening_id is not null;
create index if not exists idx_candidate_call_logs_follow_up on public.candidate_call_logs(next_follow_up_at) where next_follow_up_at is not null;

alter table public.candidate_call_logs enable row level security;
drop policy if exists "call logs owner or admin read" on public.candidate_call_logs;
create policy "call logs owner or admin read" on public.candidate_call_logs for select to authenticated using ((select auth.uid())=recruiter_id or public.is_admin());
drop policy if exists "call logs owner or admin insert" on public.candidate_call_logs;
create policy "call logs owner or admin insert" on public.candidate_call_logs for insert to authenticated with check ((select auth.uid())=recruiter_id or public.is_admin());
drop policy if exists "call logs owner or admin update" on public.candidate_call_logs;
create policy "call logs owner or admin update" on public.candidate_call_logs for update to authenticated using ((select auth.uid())=recruiter_id or public.is_admin()) with check ((select auth.uid())=recruiter_id or public.is_admin());

create table if not exists public.client_submissions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id),
  requirement_id uuid not null references public.requirements(id),
  recruiter_id uuid not null references public.profiles(id),
  submitted_by uuid not null references public.profiles(id),
  original_filename text not null,
  storage_path text not null unique,
  mime_type text,
  file_size bigint not null default 0 check (file_size>=0),
  candidate_count integer not null default 1 check (candidate_count>0),
  notes text,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_client_submissions_recruiter_date on public.client_submissions(recruiter_id,submitted_at desc);
create index if not exists idx_client_submissions_client_requirement on public.client_submissions(client_id,requirement_id,submitted_at desc);
create index if not exists idx_client_submissions_requirement on public.client_submissions(requirement_id);
create index if not exists idx_client_submissions_submitted_by on public.client_submissions(submitted_by);

alter table public.client_submissions enable row level security;
drop policy if exists "client submissions admin read" on public.client_submissions;
create policy "client submissions admin read" on public.client_submissions for select to authenticated using (public.is_admin());
drop policy if exists "client submissions admin insert" on public.client_submissions;
create policy "client submissions admin insert" on public.client_submissions for insert to authenticated with check (public.is_admin() and (select auth.uid())=submitted_by);
drop policy if exists "client submissions admin update" on public.client_submissions;
create policy "client submissions admin update" on public.client_submissions for update to authenticated using (public.is_admin()) with check (public.is_admin());

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('client-submissions','client-submissions',false,10485760,array['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.ms-excel','text/csv'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "client submission admin upload" on storage.objects;
create policy "client submission admin upload" on storage.objects for insert to authenticated with check (bucket_id='client-submissions' and public.is_admin() and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists "client submission admin read" on storage.objects;
create policy "client submission admin read" on storage.objects for select to authenticated using (bucket_id='client-submissions' and public.is_admin());
drop policy if exists "client submission admin delete" on storage.objects;
create policy "client submission admin delete" on storage.objects for delete to authenticated using (bucket_id='client-submissions' and public.is_admin());

create or replace function public.log_recruitment_tracker_activity()
returns trigger
language plpgsql
set search_path=''
as $$
declare
  actor uuid := auth.uid();
  action_text text;
  details_json jsonb;
begin
  if tg_table_name='candidate_call_logs' then
    action_text := 'Candidate call recorded';
    details_json := jsonb_build_object('candidate_id',new.candidate_id,'requirement_id',new.requirement_id,'call_outcome',new.call_outcome,'next_follow_up_at',new.next_follow_up_at);
  else
    action_text := 'Client submission file uploaded';
    details_json := jsonb_build_object('client_id',new.client_id,'requirement_id',new.requirement_id,'recruiter_id',new.recruiter_id,'candidate_count',new.candidate_count,'filename',new.original_filename);
  end if;
  insert into public.activity_logs(actor_id,action,entity_type,entity_id,details)
  values(actor,action_text,tg_table_name,new.id::text,details_json||jsonb_build_object('source','database_audit'));
  return new;
end;
$$;

drop trigger if exists audit_candidate_call_logs on public.candidate_call_logs;
create trigger audit_candidate_call_logs after insert on public.candidate_call_logs for each row execute function public.log_recruitment_tracker_activity();
drop trigger if exists audit_client_submissions on public.client_submissions;
create trigger audit_client_submissions after insert on public.client_submissions for each row execute function public.log_recruitment_tracker_activity();

grant select,insert,update on public.candidate_call_logs to authenticated;
grant select,insert,update on public.client_submissions to authenticated;
