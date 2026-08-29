-- TSS management reporting, recruiter EOD submissions and Super Admin support.

alter table public.profiles
  add column if not exists is_super_admin boolean not null default false;

create table if not exists public.daily_submission_reports (
  id uuid primary key default gen_random_uuid(),
  recruiter_id uuid not null references public.profiles(id) on delete cascade,
  report_date date not null default current_date,
  status text not null default 'submitted' check (status in ('draft','submitted')),
  remarks text,
  submissions jsonb not null default '[]'::jsonb,
  metrics jsonb not null default '{}'::jsonb,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(recruiter_id, report_date)
);

create index if not exists daily_submission_reports_date_idx
  on public.daily_submission_reports(report_date desc);
create index if not exists daily_submission_reports_recruiter_idx
  on public.daily_submission_reports(recruiter_id, report_date desc);

alter table public.daily_submission_reports enable row level security;

grant select, insert, update on public.daily_submission_reports to authenticated;
grant all on public.daily_submission_reports to service_role;

drop policy if exists "daily reports self or admin read" on public.daily_submission_reports;
create policy "daily reports self or admin read"
on public.daily_submission_reports for select to authenticated
using (recruiter_id = (select auth.uid()) or public.is_admin());

drop policy if exists "daily reports self insert" on public.daily_submission_reports;
create policy "daily reports self insert"
on public.daily_submission_reports for insert to authenticated
with check (recruiter_id = (select auth.uid()));

drop policy if exists "daily reports self update" on public.daily_submission_reports;
create policy "daily reports self update"
on public.daily_submission_reports for update to authenticated
using (recruiter_id = (select auth.uid()))
with check (recruiter_id = (select auth.uid()));

create or replace function public.set_daily_submission_report_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_daily_submission_report_updated_at on public.daily_submission_reports;
create trigger set_daily_submission_report_updated_at
before update on public.daily_submission_reports
for each row execute function public.set_daily_submission_report_updated_at();