-- Exclude selected team members from Todo inactivity nudge emails.
insert into public.automation_settings(key,value,updated_at)
values('todo_nudge_excluded_emails','veena.a@talent-stock.com',now())
on conflict (key) do update
set value=case
      when exists(
        select 1
        from unnest(string_to_array(lower(public.automation_settings.value),',')) existing_email
        where trim(existing_email)=lower('veena.a@talent-stock.com')
      ) then public.automation_settings.value
      else public.automation_settings.value||',veena.a@talent-stock.com'
    end,
    updated_at=now();

create or replace function public.claim_todo_nudges_with_key(
  p_key text,
  p_slot text,
  p_limit integer default 50
)
returns table(
  event_id uuid,
  profile_id uuid,
  full_name text,
  email text,
  role public.user_role,
  slot text
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
  v_day_start timestamptz := (v_today::timestamp at time zone 'Asia/Kolkata');
begin
  if p_slot not in ('11:30','15:30') then
    raise exception 'invalid slot';
  end if;
  if not exists(
    select 1
    from public.automation_settings s
    where s.key='todo_nudge_cron_key' and s.value=p_key
  ) then
    raise exception 'unauthorized';
  end if;

  insert into public.todo_nudge_events(profile_id,nudge_date,slot,status)
  select p.id,v_today,p_slot,'Pending'
  from public.profiles p
  where p.is_active is true
    and coalesce(p.is_super_admin,false) is false
    and p.role in ('admin'::public.user_role,'recruiter'::public.user_role)
    and nullif(trim(p.email),'') is not null
    and not exists(
      select 1
      from public.automation_settings x
      cross join lateral unnest(string_to_array(lower(x.value),',')) excluded_email
      where x.key='todo_nudge_excluded_emails'
        and trim(excluded_email)=lower(trim(p.email))
    )
    and not exists(
      select 1
      from public.activity_logs a
      where a.actor_id=p.id
        and a.created_at>=v_day_start
        and a.created_at<=now()
    )
  on conflict on constraint todo_nudge_events_profile_id_nudge_date_slot_key do nothing;

  update public.todo_nudge_events e
  set status='Skipped',updated_at=now()
  where e.nudge_date=v_today
    and e.slot=p_slot
    and e.status in ('Pending','Failed')
    and (
      exists(
        select 1
        from public.activity_logs a
        where a.actor_id=e.profile_id
          and a.created_at>=v_day_start
          and a.created_at<=now()
      )
      or exists(
        select 1
        from public.profiles p
        join public.automation_settings x on x.key='todo_nudge_excluded_emails'
        cross join lateral unnest(string_to_array(lower(x.value),',')) excluded_email
        where p.id=e.profile_id
          and trim(excluded_email)=lower(trim(p.email))
      )
    );

  return query
  with picked as (
    select e.id
    from public.todo_nudge_events e
    join public.profiles p on p.id=e.profile_id
    where e.nudge_date=v_today
      and e.slot=p_slot
      and e.status in ('Pending','Failed')
      and p.is_active is true
      and coalesce(p.is_super_admin,false) is false
      and p.role in ('admin'::public.user_role,'recruiter'::public.user_role)
      and not exists(
        select 1
        from public.automation_settings x
        cross join lateral unnest(string_to_array(lower(x.value),',')) excluded_email
        where x.key='todo_nudge_excluded_emails'
          and trim(excluded_email)=lower(trim(p.email))
      )
      and not exists(
        select 1
        from public.activity_logs a
        where a.actor_id=p.id
          and a.created_at>=v_day_start
          and a.created_at<=now()
      )
    order by e.created_at
    limit greatest(1,least(coalesce(p_limit,50),100))
    for update of e skip locked
  ), claimed as (
    update public.todo_nudge_events e
       set status='Claimed',
           claimed_at=now(),
           attempt_count=e.attempt_count+1,
           updated_at=now()
      from picked
     where e.id=picked.id
     returning e.id,e.profile_id,e.slot
  )
  select c.id,c.profile_id,p.full_name,p.email,p.role,c.slot
  from claimed c
  join public.profiles p on p.id=c.profile_id;
end
$function$;

-- Stop any already-created unsent nudge for excluded recipients.
update public.todo_nudge_events e
set status='Skipped',updated_at=now()
where e.status in ('Pending','Failed','Claimed')
  and exists(
    select 1
    from public.profiles p
    join public.automation_settings x on x.key='todo_nudge_excluded_emails'
    cross join lateral unnest(string_to_array(lower(x.value),',')) excluded_email
    where p.id=e.profile_id
      and trim(excluded_email)=lower(trim(p.email))
  );

revoke all on function public.claim_todo_nudges_with_key(text,text,integer)
  from public, anon, authenticated;
grant execute on function public.claim_todo_nudges_with_key(text,text,integer)
  to service_role;
