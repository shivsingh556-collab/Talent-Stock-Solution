-- Talent Buddy / TSS Resume Screening backend schema
-- Target: Supabase Postgres

create extension if not exists pgcrypto;

create type public.user_role as enum ('admin','recruiter');
create type public.requirement_status as enum ('Active','On Hold','Closed');
create type public.screening_recommendation as enum ('Strong Match','Review Recommended','Not Suitable');
create type public.recruiter_decision as enum ('Pending','Shortlisted','Rejected','Keep for Future','Updated Resume Requested');

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  role public.user_role not null default 'recruiter',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  industry text,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.requirements (
  id uuid primary key default gen_random_uuid(),
  tss_id text not null unique,
  client_id uuid not null references public.clients(id) on delete restrict,
  job_title text not null,
  location text,
  experience_min numeric,
  experience_max numeric,
  experience_text text,
  salary_range text,
  industry text,
  qualification text,
  responsibilities text,
  jd_text text,
  jd_file_path text,
  status public.requirement_status not null default 'Active',
  mandatory_skills text[] not null default '{}',
  preferred_skills text[] not null default '{}',
  ai_suggested_skills text[] not null default '{}',
  ai_skills_approved boolean not null default false,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.candidates (
  id uuid primary key default gen_random_uuid(),
  candidate_name text not null,
  email text,
  phone text,
  current_location text,
  preferred_location text,
  total_experience numeric,
  relevant_experience numeric,
  current_company text,
  current_designation text,
  skills text[] not null default '{}',
  education text,
  notice_period text,
  current_ctc text,
  expected_ctc text,
  uploaded_by uuid references public.profiles(id),
  last_screened_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists candidates_email_unique_idx on public.candidates(lower(email)) where email is not null and email <> '';
create unique index if not exists candidates_phone_unique_idx on public.candidates(phone) where phone is not null and phone <> '';

create table if not exists public.resume_versions (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  storage_path text not null,
  original_filename text,
  mime_type text,
  file_size bigint,
  file_hash text,
  extracted_text text,
  is_current boolean not null default true,
  is_outdated boolean not null default false,
  uploaded_by uuid references public.profiles(id),
  uploaded_at timestamptz not null default now()
);

create unique index if not exists resume_hash_unique_idx on public.resume_versions(file_hash) where file_hash is not null and file_hash <> '';

create table if not exists public.screenings (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  requirement_id uuid not null references public.requirements(id) on delete cascade,
  resume_version_id uuid references public.resume_versions(id) on delete set null,
  overall_score numeric not null default 0 check (overall_score between 0 and 100),
  mandatory_skill_score numeric default 0,
  preferred_skill_score numeric default 0,
  experience_score numeric default 0,
  domain_score numeric default 0,
  location_score numeric default 0,
  matching_skills text[] not null default '{}',
  missing_skills text[] not null default '{}',
  strengths text[] not null default '{}',
  concerns text[] not null default '{}',
  explanation text,
  ai_recommendation public.screening_recommendation,
  final_recommendation public.screening_recommendation,
  recruiter_decision public.recruiter_decision not null default 'Pending',
  recruiter_notes text,
  manually_overridden boolean not null default false,
  screened_by uuid references public.profiles(id),
  screened_at timestamptz not null default now()
);

create table if not exists public.candidate_requirement_matches (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  requirement_id uuid not null references public.requirements(id) on delete cascade,
  match_score numeric not null default 0,
  matching_skills text[] not null default '{}',
  missing_skills text[] not null default '{}',
  recommendation public.screening_recommendation,
  last_calculated_at timestamptz not null default now(),
  ignored boolean not null default false,
  unique(candidate_id, requirement_id)
);

create table if not exists public.candidate_notes (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  requirement_id uuid references public.requirements(id) on delete set null,
  note text not null,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.interviews (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  requirement_id uuid not null references public.requirements(id) on delete cascade,
  scheduled_at timestamptz not null,
  status text not null default 'Scheduled',
  interview_type text,
  interviewer text,
  location_or_link text,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.activity_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id),
  action text not null,
  entity_type text,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- helper function for admin checks
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin' and p.is_active = true
  );
$$;

-- auto-create profile when a Supabase auth user is created
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)),
    new.email,
    'recruiter'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- updated_at helper
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger profiles_updated_at before update on public.profiles for each row execute procedure public.set_updated_at();
create trigger clients_updated_at before update on public.clients for each row execute procedure public.set_updated_at();
create trigger requirements_updated_at before update on public.requirements for each row execute procedure public.set_updated_at();
create trigger candidates_updated_at before update on public.candidates for each row execute procedure public.set_updated_at();
create trigger interviews_updated_at before update on public.interviews for each row execute procedure public.set_updated_at();

-- RLS
alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.requirements enable row level security;
alter table public.candidates enable row level security;
alter table public.resume_versions enable row level security;
alter table public.screenings enable row level security;
alter table public.candidate_requirement_matches enable row level security;
alter table public.candidate_notes enable row level security;
alter table public.interviews enable row level security;
alter table public.activity_logs enable row level security;

create policy "profiles self or admin read" on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy "profiles admin update" on public.profiles for update using (public.is_admin());

create policy "clients authenticated read" on public.clients for select to authenticated using (true);
create policy "clients authenticated insert" on public.clients for insert to authenticated with check (auth.uid() = created_by or public.is_admin());
create policy "clients creator or admin update" on public.clients for update to authenticated using (created_by = auth.uid() or public.is_admin());

create policy "requirements authenticated read" on public.requirements for select to authenticated using (true);
create policy "requirements creator insert" on public.requirements for insert to authenticated with check (created_by = auth.uid() or public.is_admin());
create policy "requirements creator or admin update" on public.requirements for update to authenticated using (created_by = auth.uid() or public.is_admin());

create policy "candidates owner or admin read" on public.candidates for select to authenticated using (uploaded_by = auth.uid() or public.is_admin());
create policy "candidates owner insert" on public.candidates for insert to authenticated with check (uploaded_by = auth.uid() or public.is_admin());
create policy "candidates owner or admin update" on public.candidates for update to authenticated using (uploaded_by = auth.uid() or public.is_admin());

create policy "resumes owner or admin read" on public.resume_versions for select to authenticated using (
  exists(select 1 from public.candidates c where c.id = candidate_id and (c.uploaded_by = auth.uid() or public.is_admin()))
);
create policy "resumes authenticated insert" on public.resume_versions for insert to authenticated with check (uploaded_by = auth.uid() or public.is_admin());

create policy "screenings owner or admin read" on public.screenings for select to authenticated using (screened_by = auth.uid() or public.is_admin());
create policy "screenings authenticated insert" on public.screenings for insert to authenticated with check (screened_by = auth.uid() or public.is_admin());
create policy "screenings owner or admin update" on public.screenings for update to authenticated using (screened_by = auth.uid() or public.is_admin());

create policy "matches authenticated read" on public.candidate_requirement_matches for select to authenticated using (true);
create policy "matches authenticated write" on public.candidate_requirement_matches for all to authenticated using (true) with check (true);

create policy "notes owner or admin read" on public.candidate_notes for select to authenticated using (created_by = auth.uid() or public.is_admin());
create policy "notes owner insert" on public.candidate_notes for insert to authenticated with check (created_by = auth.uid() or public.is_admin());

create policy "interviews authenticated read" on public.interviews for select to authenticated using (created_by = auth.uid() or public.is_admin());
create policy "interviews authenticated insert" on public.interviews for insert to authenticated with check (created_by = auth.uid() or public.is_admin());
create policy "interviews authenticated update" on public.interviews for update to authenticated using (created_by = auth.uid() or public.is_admin());

create policy "activity admin read" on public.activity_logs for select to authenticated using (public.is_admin() or actor_id = auth.uid());
create policy "activity authenticated insert" on public.activity_logs for insert to authenticated with check (actor_id = auth.uid() or public.is_admin());

-- Storage bucket should be created from Supabase dashboard or via storage API:
-- bucket: candidate-resumes, private=true
-- Suggested storage policies (run after bucket exists):
-- create policy "resume owner upload" on storage.objects for insert to authenticated
-- with check (bucket_id='candidate-resumes' and (storage.foldername(name))[1] = auth.uid()::text);
-- create policy "resume owner read" on storage.objects for select to authenticated
-- using (bucket_id='candidate-resumes' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
