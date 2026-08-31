alter table public.interviews
  add column if not exists interview_stage text not null default 'Scheduled';

create table if not exists public.interview_update_email_events (
  id uuid primary key default gen_random_uuid(),
  interview_id uuid not null references public.interviews(id) on delete cascade,
  interview_stage text,
  outcome text,
  outcome_notes text,
  changed_by uuid,
  due_at timestamptz not null default now(),
  status text not null default 'Pending',
  claimed_at timestamptz,
  sent_at timestamptz,
  attempt_count integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_interview_update_email_events_due
  on public.interview_update_email_events(status,due_at);

alter table public.interview_update_email_events enable row level security;
revoke all on public.interview_update_email_events from anon, authenticated;

drop trigger if exists trg_interview_update_admin_email on public.interviews;
drop function if exists public.queue_interview_update_admin_email();
create function public.queue_interview_update_admin_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (old.interview_stage is distinct from new.interview_stage)
     or (old.outcome is distinct from new.outcome)
     or (old.outcome_notes is distinct from new.outcome_notes) then
    insert into public.interview_update_email_events(interview_id,interview_stage,outcome,outcome_notes,changed_by,due_at)
    values(new.id,new.interview_stage,new.outcome,new.outcome_notes,auth.uid(),now());
  end if;
  return new;
end $$;
revoke all on function public.queue_interview_update_admin_email() from public, anon, authenticated;

create trigger trg_interview_update_admin_email
after update of interview_stage, outcome, outcome_notes on public.interviews
for each row execute function public.queue_interview_update_admin_email();

drop function if exists public.claim_due_interview_update_email_events_with_key(text,integer);
create function public.claim_due_interview_update_email_events_with_key(p_key text, p_limit integer default 20)
returns table(event_id uuid,interview_id uuid,interview_stage text,outcome text,outcome_notes text,candidate_name text,job_title text,client_name text,scheduled_at timestamptz,changed_by_name text,recipient_emails text[])
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists(select 1 from public.automation_settings where key='interview_email_cron_key' and value=p_key) then raise exception 'unauthorized'; end if;
  update public.interview_update_email_events set status='Pending',claimed_at=null,updated_at=now() where status='Claimed' and claimed_at < now()-interval '10 minutes';
  update public.interview_update_email_events set status='Pending',updated_at=now() where status='Failed' and attempt_count < 3 and updated_at < now()-interval '2 minutes';
  return query
  with picked as (
    select e.id from public.interview_update_email_events e
    where e.status='Pending' and e.due_at<=now()
    order by e.due_at for update skip locked limit greatest(1,least(p_limit,50))
  ), claimed as (
    update public.interview_update_email_events e
    set status='Claimed',claimed_at=now(),attempt_count=e.attempt_count+1,updated_at=now()
    from picked p where e.id=p.id returning e.*
  )
  select c.id,c.interview_id,c.interview_stage,c.outcome,c.outcome_notes,
         coalesce(i.candidate_name_snapshot,'Candidate'),coalesce(i.job_title_snapshot,'Position'),coalesce(i.client_name_snapshot,'Client'),i.scheduled_at,
         coalesce(p.full_name,p.email,'Team Member'),
         coalesce((select array_agg(distinct pr.email order by pr.email) from public.profiles pr where pr.is_active=true and lower(pr.role::text)='admin' and pr.email is not null),array[]::text[])
  from claimed c join public.interviews i on i.id=c.interview_id left join public.profiles p on p.id=c.changed_by;
end $$;
revoke all on function public.claim_due_interview_update_email_events_with_key(text,integer) from public, authenticated;
grant execute on function public.claim_due_interview_update_email_events_with_key(text,integer) to anon;

drop function if exists public.mark_interview_update_email_event_with_key(text,uuid,text,text);
create function public.mark_interview_update_email_event_with_key(p_key text,p_event_id uuid,p_status text,p_error text default null)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists(select 1 from public.automation_settings where key='interview_email_cron_key' and value=p_key) then raise exception 'unauthorized'; end if;
  update public.interview_update_email_events
  set status=p_status,sent_at=case when p_status='Sent' then now() else sent_at end,last_error=p_error,updated_at=now()
  where id=p_event_id;
  return found;
end $$;
revoke all on function public.mark_interview_update_email_event_with_key(text,uuid,text,text) from public, authenticated;
grant execute on function public.mark_interview_update_email_event_with_key(text,uuid,text,text) to anon;