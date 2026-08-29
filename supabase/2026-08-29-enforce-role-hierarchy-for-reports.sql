create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and is_super_admin = true and is_active = true
  );
$$;

revoke all on function public.is_super_admin() from public, anon;
grant execute on function public.is_super_admin() to authenticated;

drop policy if exists "activity admin read" on public.activity_logs;
create policy "activity role hierarchy read"
on public.activity_logs for select to authenticated
using (
  actor_id = (select auth.uid())
  or public.is_super_admin()
  or (
    public.is_admin()
    and exists (
      select 1 from public.profiles target
      where target.id = activity_logs.actor_id
        and target.is_super_admin = false
        and target.role in ('recruiter','admin')
    )
  )
);

drop policy if exists "profiles self or admin read" on public.profiles;
create policy "profiles role hierarchy read"
on public.profiles for select to authenticated
using (
  id = (select auth.uid())
  or public.is_super_admin()
  or (public.is_admin() and is_super_admin = false)
);

drop policy if exists "profiles admin update" on public.profiles;
create policy "profiles hierarchy update"
on public.profiles for update to authenticated
using (
  public.is_super_admin()
  or (public.is_admin() and is_super_admin = false)
)
with check (
  public.is_super_admin()
  or (public.is_admin() and is_super_admin = false)
);

drop policy if exists "profiles admin delete" on public.profiles;
create policy "profiles hierarchy delete"
on public.profiles for delete to authenticated
using (
  public.is_super_admin()
  or (public.is_admin() and is_super_admin = false)
);

drop policy if exists "profiles admin insert" on public.profiles;
create policy "profiles hierarchy insert"
on public.profiles for insert to authenticated
with check (
  public.is_super_admin()
  or (public.is_admin() and is_super_admin = false)
);