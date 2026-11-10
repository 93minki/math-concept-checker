-- profiles: one row per Supabase Auth user (F-01).
-- signup_status is the F-11 hook: today every signup goes straight to
-- 'completed'; F-11 will add a guardian-consent step before it.
-- Design: docs/DESIGN.md "DB 스키마" (profiles, 접근 권한).

create type public.signup_status as enum ('pending', 'completed');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  signup_status public.signup_status not null default 'pending',
  signup_completed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint profiles_completed_at_matches_status check (
    (signup_status = 'completed') = (signup_completed_at is not null)
  )
);

comment on table public.profiles is
  'One row per auth user. Written only by the backend (secret key); users can read their own row.';

-- RLS on: users only ever see their own row (AGENTS.md 4.3).
alter table public.profiles enable row level security;

-- New tables are not exposed automatically in this project, so grant explicitly.
-- Students: read only. All writes go through the backend.
revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;
grant select, insert, update on table public.profiles to service_role;

create policy "profiles_select_own"
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);
