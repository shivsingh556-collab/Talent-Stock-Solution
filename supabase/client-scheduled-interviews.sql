-- Client-arranged interviews are records, never a second invitation.
begin;
alter table public.interviews
  add column if not exists scheduling_source text not null default 'tss'
    check (scheduling_source in ('tss','client')),
  add column if not exists interview_round integer
    check (interview_round between 1 and 6);

-- Existing records have an unknown round and remain unchanged.
create unique index if not exists interviews_active_candidate_requirement_round
  on public.interviews(candidate_id,requirement_id,interview_round)
  where interview_round is not null and archived_at is null
    and cancelled_at is null and status in ('Scheduled','Confirmed','Reschedule Requested');

create or replace function private.guard_interview_scheduling_source()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op='UPDATE' and new.scheduling_source is distinct from old.scheduling_source then
    raise exception 'Keep the original scheduling source when updating an interview.' using errcode='23514';
  end if;
  if new.scheduling_source='client' then
    if auth.uid() is not null and not private.is_admin() then
      raise exception 'Only admins and super admins can record client-scheduled interviews.' using errcode='42501';
    end if;
    new.reminder_morning_enabled := false;
    new.reminder_pre_enabled := false;
    new.reminder_status := 'Disabled - Client Scheduled';
  end if;
  if new.interview_round is not null and new.archived_at is null
      and new.cancelled_at is null and new.status in ('Scheduled','Confirmed','Reschedule Requested') then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
      new.candidate_id::text||':'||new.requirement_id::text||':'||new.interview_round::text,0));
    if exists(select 1 from public.interviews i
      where i.id<>new.id and i.candidate_id=new.candidate_id and i.requirement_id=new.requirement_id
        and coalesce(i.interview_round,1)=new.interview_round
        and i.archived_at is null and i.cancelled_at is null
        and i.status in ('Scheduled','Confirmed','Reschedule Requested')) then
      raise exception 'An active interview already exists for this candidate, requirement and round. Edit / Reschedule that record.' using errcode='23505';
    end if;
  end if;
  return new;
end $$;
revoke all on function private.guard_interview_scheduling_source() from public,anon,authenticated;
drop trigger if exists guard_interview_scheduling_source on public.interviews;
create trigger guard_interview_scheduling_source before insert or update on public.interviews
for each row execute function private.guard_interview_scheduling_source();

-- Retain the current email queue logic and its grants; stop before inserting
-- any candidate confirmations/reminders for client-arranged entries.
do $$
declare definition text;
begin
  definition:=pg_get_functiondef('public.refresh_interview_email_events(uuid)'::regprocedure);
  if position('i.scheduling_source' in definition)=0 then
    if position('if i.status not in' in definition)=0 then
      raise exception 'Unexpected interview email queue function; review before applying.';
    end if;
    definition:=replace(definition,'if i.status not in',
      E'if i.scheduling_source = ''client'' then return; end if;\n\n  if i.status not in');
    execute definition;
  end if;
end $$;
commit;
