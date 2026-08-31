alter type public.recruiter_decision add value if not exists 'Client Submitted';
alter type public.recruiter_decision add value if not exists 'Interview';
alter type public.recruiter_decision add value if not exists 'Final Select';
alter type public.recruiter_decision add value if not exists 'Joined-TSS';

alter table public.interviews add column if not exists outcome text;
alter table public.interviews add column if not exists outcome_notes text;
alter table public.interviews add column if not exists outcome_updated_at timestamptz;

create index if not exists idx_interviews_outcome on public.interviews(outcome) where outcome is not null;