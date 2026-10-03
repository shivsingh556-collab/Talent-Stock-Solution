-- Immutable first-work credit prevents repeated runs or deletion/recreation from earning new counts.
create table public.screening_work_credits (
 candidate_id uuid not null,
 requirement_id uuid not null,
 screening_id uuid not null unique,
 screened_by uuid,
 screened_at timestamptz not null,
 primary key(candidate_id,requirement_id)
);
alter table public.screening_work_credits enable row level security;
create policy "screening credits owner or admin read" on public.screening_work_credits for select to authenticated using (screened_by=(select auth.uid()) or public.is_admin());
revoke all on public.screening_work_credits from public,anon,authenticated;
grant select on public.screening_work_credits to authenticated;
insert into public.screening_work_credits(candidate_id,requirement_id,screening_id,screened_by,screened_at)
select distinct on (candidate_id,requirement_id) candidate_id,requirement_id,id,screened_by,screened_at
from public.screenings where candidate_id is not null and requirement_id is not null
order by candidate_id,requirement_id,screened_at,id;
create function public.record_unique_screening_work() returns trigger language plpgsql security definer set search_path='' as $fn$
begin
 if new.candidate_id is not null and new.requirement_id is not null then
 insert into public.screening_work_credits(candidate_id,requirement_id,screening_id,screened_by,screened_at)
 values(new.candidate_id,new.requirement_id,new.id,new.screened_by,new.screened_at)
 on conflict(candidate_id,requirement_id) do nothing;
 end if;
 return new;
end $fn$;
revoke all on function public.record_unique_screening_work() from public,anon,authenticated;
create trigger record_unique_screening_work after insert on public.screenings for each row execute function public.record_unique_screening_work();
create view public.performance_screenings with (security_invoker=true) as
select c.screening_id as id,c.candidate_id,c.requirement_id,c.screened_by,c.screened_at,
 s.final_recommendation,s.recruiter_decision,s.overall_score
from public.screening_work_credits c left join public.screenings s on s.id=c.screening_id;
revoke all on public.performance_screenings from public,anon;
grant select on public.performance_screenings to authenticated;
