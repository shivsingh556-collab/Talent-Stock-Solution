-- TSS Resume Intelligence: secure company auth + workbook-safe requirement identity
-- Run AFTER supabase/schema.sql in Supabase SQL Editor.

-- 1) Requirement identity: the uploaded workbook contains two visible TSS040 records.
-- Keep tss_id as a display/business identifier and use profile_key as the unique database identity.
alter table public.requirements add column if not exists profile_key text;

-- Drop the old UNIQUE constraint created by: tss_id text not null unique
-- PostgreSQL normally names it requirements_tss_id_key.
alter table public.requirements drop constraint if exists requirements_tss_id_key;
create index if not exists requirements_tss_id_idx on public.requirements(tss_id);
create unique index if not exists requirements_profile_key_unique_idx
  on public.requirements(profile_key)
  where profile_key is not null and profile_key <> '';

-- 2) Server-side company-domain gate.
-- This is the real security check; the frontend @talent-stock.com check is only UX.
create or replace function public.hook_restrict_tss_signup(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  email text;
  domain text;
begin
  email := lower(coalesce(event->'user'->>'email',''));
  domain := split_part(email, '@', 2);

  if domain <> 'talent-stock.com' then
    return jsonb_build_object(
      'error', jsonb_build_object(
        'http_code', 403,
        'message', 'Only @talent-stock.com company email addresses are allowed.'
      )
    );
  end if;

  return '{}'::jsonb;
end;
$$;

grant execute on function public.hook_restrict_tss_signup(jsonb) to supabase_auth_admin;
revoke execute on function public.hook_restrict_tss_signup(jsonb) from authenticated, anon, public;

-- 3) Defense-in-depth: profile creation also refuses non-company users.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if lower(split_part(coalesce(new.email,''),'@',2)) <> 'talent-stock.com' then
    raise exception 'Only @talent-stock.com users are allowed';
  end if;

  insert into public.profiles (id, full_name, email, role, is_active)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)),
    lower(new.email),
    'recruiter',
    true
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(public.profiles.full_name, excluded.full_name),
        updated_at = now();
  return new;
end;
$$;

-- 4) Useful profile lookup + email uniqueness.
create unique index if not exists profiles_email_unique_idx
  on public.profiles(lower(email))
  where email is not null and email <> '';

-- Recommended for an internal-only app:
-- In Supabase Dashboard > Authentication > Providers > Email:
--   Confirm email: ON
-- In Authentication > Settings:
--   Either disable public sign-ups and invite/create employees yourself,
--   OR keep sign-ups enabled and configure hook_restrict_tss_signup as the Before User Created hook.
