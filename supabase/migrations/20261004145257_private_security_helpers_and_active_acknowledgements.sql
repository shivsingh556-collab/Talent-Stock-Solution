create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

alter function public.is_admin() set schema private;
alter function public.is_super_admin() set schema private;
alter function public.get_requirement_assignment_acknowledgements(uuid) set schema private;

create or replace function private.get_requirement_assignment_acknowledgements(p_requirement_id uuid)
returns table(recipient_ref text,recipient_email text,email_sent_at timestamptz,acknowledgement_status text,acknowledged_at timestamptz)
language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'unauthorized' using errcode='42501'; end if;
  if not exists (
    select 1 from public.requirements r join public.profiles p on p.id=v_uid
    where r.id=p_requirement_id and p.is_active=true and (
      r.created_by=v_uid or p.role='admin'
      or (nullif(trim(r.requirement_handler),'') is not null and (
        lower(r.requirement_handler)=lower(nullif(trim(p.full_name),''))
        or lower(r.requirement_handler)=lower(split_part(nullif(trim(p.email),''),'@',1))
      ))
    )
  ) then raise exception 'forbidden' using errcode='42501'; end if;
  return query select distinct on(e.recipient_ref) e.recipient_ref,e.recipient_email,e.sent_at,e.acknowledgement_status,e.acknowledged_at
  from public.requirement_email_events e where e.requirement_id=p_requirement_id and e.event_type='assigned'
  order by e.recipient_ref,e.created_at desc;
end;
$$;

create function public.is_admin() returns boolean language sql stable security invoker set search_path=''
as $$select private.is_admin()$$;
create function public.is_super_admin() returns boolean language sql stable security invoker set search_path=''
as $$select private.is_super_admin()$$;
create function public.get_requirement_assignment_acknowledgements(p_requirement_id uuid)
returns table(recipient_ref text,recipient_email text,email_sent_at timestamptz,acknowledgement_status text,acknowledged_at timestamptz)
language sql security invoker set search_path=''
as $$select * from private.get_requirement_assignment_acknowledgements(p_requirement_id)$$;

revoke all on function private.is_admin(),private.is_super_admin(),private.get_requirement_assignment_acknowledgements(uuid) from public,anon;
grant execute on function private.is_admin(),private.is_super_admin(),private.get_requirement_assignment_acknowledgements(uuid) to authenticated,service_role;
revoke all on function public.is_admin(),public.is_super_admin(),public.get_requirement_assignment_acknowledgements(uuid) from public,anon;
grant execute on function public.is_admin(),public.is_super_admin(),public.get_requirement_assignment_acknowledgements(uuid) to authenticated,service_role;
