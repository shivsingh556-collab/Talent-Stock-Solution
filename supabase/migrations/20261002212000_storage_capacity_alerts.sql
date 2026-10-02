-- Hourly singleton snapshot; browsers never scan files or database sizes.
create schema if not exists todo_monitoring;
revoke all on schema todo_monitoring from public, anon, authenticated;
create table public.storage_usage_snapshot (
  id boolean primary key default true check (id),
  database_bytes bigint not null default 0,
  storage_bytes bigint not null default 0,
  file_count bigint not null default 0,
  database_limit_bytes bigint not null default 500000000 check (database_limit_bytes > 0),
  storage_limit_bytes bigint not null default 1000000000 check (storage_limit_bytes > 0),
  plan_label text not null default 'Free',
  checked_at timestamptz not null default now()
);
alter table public.storage_usage_snapshot enable row level security;
revoke all on public.storage_usage_snapshot from public, anon, authenticated;
grant select on public.storage_usage_snapshot to authenticated;
create policy "Active admins read capacity" on public.storage_usage_snapshot
for select to authenticated using ((select public.is_admin()));
-- Elevated access is restricted to the internal cron task. No browser can call it.
create function todo_monitoring.refresh_storage_usage() returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.storage_usage_snapshot (id, database_bytes, storage_bytes, file_count, checked_at)
  select true, pg_catalog.pg_database_size(pg_catalog.current_database()),
         coalesce(sum(case when metadata->>'size' ~ '^[0-9]+$' then (metadata->>'size')::bigint else 0 end),0),
         count(*), pg_catalog.now()
  from storage.objects
  on conflict (id) do update set database_bytes=excluded.database_bytes,
    storage_bytes=excluded.storage_bytes, file_count=excluded.file_count, checked_at=excluded.checked_at;
end;
$$;
revoke all on function todo_monitoring.refresh_storage_usage() from public, anon, authenticated;
select todo_monitoring.refresh_storage_usage();
select cron.schedule('todo_ai_storage_usage_hourly','17 * * * *','select todo_monitoring.refresh_storage_usage();');
comment on table public.storage_usage_snapshot is 'Live project capacity estimate, refreshed hourly. File totals use object metadata, not billing-period average. Update configured limits after a plan change.';
