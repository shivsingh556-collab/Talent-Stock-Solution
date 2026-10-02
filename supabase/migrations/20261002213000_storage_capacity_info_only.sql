drop policy "Active admins read capacity" on public.storage_usage_snapshot;
create policy "Info account reads capacity" on public.storage_usage_snapshot
for select to authenticated using (exists (
 select 1 from public.profiles p where p.id=(select auth.uid())
 and p.email='info@talent-stock.com' and p.role='admin' and p.is_active=true
));
