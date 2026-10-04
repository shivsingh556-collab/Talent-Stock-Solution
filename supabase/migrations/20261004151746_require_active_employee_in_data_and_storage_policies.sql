create or replace function private.is_active_user()
returns boolean language sql stable security definer set search_path=''
as $$select exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_active=true)$$;
revoke all on function private.is_active_user() from public,anon;
grant execute on function private.is_active_user() to authenticated,service_role;
do $$
declare t record;
begin
  for t in select n.nspname,c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where c.relrowsecurity and c.relkind in ('r','p') and (n.nspname='public' or (n.nspname='storage' and c.relname='objects'))
  loop
    execute format('create policy "active employee required" on %I.%I as restrictive for all to authenticated using ((select private.is_active_user())) with check ((select private.is_active_user()))',t.nspname,t.relname);
  end loop;
end $$;
