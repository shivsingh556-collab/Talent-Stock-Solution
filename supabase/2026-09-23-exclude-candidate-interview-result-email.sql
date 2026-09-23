-- Interview results are internal. Never include the candidate's email in update notifications.
create or replace function public.claim_due_interview_update_email_events_with_key(
  p_key text,
  p_limit integer default 20
)
returns table(
  event_id uuid,
  interview_id uuid,
  interview_stage text,
  outcome text,
  outcome_notes text,
  candidate_name text,
  job_title text,
  client_name text,
  scheduled_at timestamptz,
  changed_by_name text,
  recipient_emails text[]
)
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if not exists(
    select 1
    from public.automation_settings
    where key='interview_email_cron_key' and value=p_key
  ) then
    raise exception 'unauthorized';
  end if;

  update public.interview_update_email_events
     set status='Pending', claimed_at=null, updated_at=now()
   where status='Claimed'
     and claimed_at < now()-interval '10 minutes';

  update public.interview_update_email_events
     set status='Pending', updated_at=now()
   where status='Failed'
     and attempt_count < 3
     and updated_at < now()-interval '2 minutes';

  return query
  with picked as (
    select e.id
    from public.interview_update_email_events e
    where e.status='Pending' and e.due_at <= now()
    order by e.due_at
    for update skip locked
    limit greatest(1,least(p_limit,50))
  ), claimed as (
    update public.interview_update_email_events e
       set status='Claimed',
           claimed_at=now(),
           attempt_count=e.attempt_count+1,
           updated_at=now()
      from picked p
     where e.id=p.id
     returning e.*
  )
  select c.id,
         c.interview_id,
         c.interview_stage,
         c.outcome,
         c.outcome_notes,
         coalesce(i.candidate_name_snapshot,'Candidate'),
         coalesce(i.job_title_snapshot,'Position'),
         coalesce(i.client_name_snapshot,'Client'),
         i.scheduled_at,
         coalesce(changer.full_name,changer.email,'Team Member'),
         coalesce(recips.emails,array[]::text[])
  from claimed c
  join public.interviews i on i.id=c.interview_id
  left join public.profiles changer on changer.id=c.changed_by
  left join public.requirements r on r.id=i.requirement_id
  left join public.clients cl on cl.id=r.client_id
  left join lateral (
    select array_agg(distinct x.email order by x.email) as emails
    from (
      select scheduler.email
      from public.profiles scheduler
      where scheduler.id=i.created_by
        and scheduler.is_active=true
        and scheduler.email is not null

      union all

      select owner_profile.email
      from lateral (
        select coalesce(
          nullif(trim(cl.client_owner),''),
          nullif(trim(r.client_owner),'')
        ) as owner_name
      ) owner_src
      join lateral (
        select p.email
        from public.profiles p
        where p.is_active=true
          and p.email is not null
          and owner_src.owner_name is not null
          and (
            lower(trim(p.full_name))=lower(trim(owner_src.owner_name))
            or lower(split_part(p.email,'@',1))=lower(trim(owner_src.owner_name))
            or lower(trim(p.full_name))=lower(
              regexp_replace(lower(trim(owner_src.owner_name)), '^([^ ]+) +(.).*$', '\\1.\\2')
            )
            or lower(split_part(p.email,'@',1))=lower(
              regexp_replace(lower(trim(owner_src.owner_name)), '^([^ ]+) +(.).*$', '\\1.\\2')
            )
            or (
              lower(trim(p.full_name))=lower(split_part(trim(owner_src.owner_name),' ',1))
              and 1=(
                select count(*)
                from public.profiles px
                where px.is_active=true
                  and lower(trim(px.full_name))=lower(split_part(trim(owner_src.owner_name),' ',1))
              )
            )
          )
        order by
          case
            when lower(trim(p.full_name))=lower(trim(owner_src.owner_name)) then 1
            when lower(split_part(p.email,'@',1))=lower(trim(owner_src.owner_name)) then 2
            when lower(trim(p.full_name))=lower(regexp_replace(lower(trim(owner_src.owner_name)), '^([^ ]+) +(.).*$', '\\1.\\2')) then 3
            when lower(split_part(p.email,'@',1))=lower(regexp_replace(lower(trim(owner_src.owner_name)), '^([^ ]+) +(.).*$', '\\1.\\2')) then 4
            else 5
          end
        limit 1
      ) owner_profile on true
    ) x
    where i.candidate_email_snapshot is null
       or lower(trim(x.email)) <> lower(trim(i.candidate_email_snapshot))
  ) recips on true;
end
$function$;

revoke all on function public.claim_due_interview_update_email_events_with_key(text,integer)
  from public, anon, authenticated;
grant execute on function public.claim_due_interview_update_email_events_with_key(text,integer)
  to service_role;
