-- Phase 1b: profiles + platform_admins, RLS helper functions, and the
-- SELECT policies deferred from 20260922000001 (they need
-- current_profile()/is_platform_admin(), which need `profiles` to
-- exist first).

create type staff_role as enum ('SUPER_ADMIN', 'HOSPITAL_ADMIN', 'RECEPTIONIST');
create type profile_status as enum ('ACTIVE', 'INACTIVE');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  hospital_id uuid references public.hospitals (id) on delete restrict,
  name text not null,
  email text not null,
  role staff_role not null,
  status profile_status not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_hospital_id_matches_role check (
    (role = 'SUPER_ADMIN' and hospital_id is null)
    or (role <> 'SUPER_ADMIN' and hospital_id is not null)
  )
);

comment on table public.profiles is
  'One row per Supabase Auth user. hospital_id is NULL only for '
  'SUPER_ADMIN rows, and nullability alone is never trusted as proof '
  'of platform-admin status -- see platform_admins.';

create index profiles_hospital_id_idx on public.profiles (hospital_id);

create table public.platform_admins (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

comment on table public.platform_admins is
  'Source of truth for SUPER_ADMIN authorization. A profiles.role of '
  'SUPER_ADMIN is a display hint only; code must check membership '
  'here, never the role column alone.';

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row
  execute function public.set_updated_at();

-- Both functions are SECURITY DEFINER so they can read `profiles`
-- (and, transitively, be called from profiles' own RLS policy) without
-- re-triggering RLS on profiles itself -- that self-reference is what
-- causes "infinite recursion detected in policy" if done as a plain
-- view/subquery instead. Each only ever returns data scoped to
-- auth.uid(), so elevating privilege here doesn't leak other users'
-- rows.

create or replace function public.current_profile()
returns table (id uuid, hospital_id uuid, role staff_role, status profile_status)
language sql
security definer
set search_path = public
stable
as $$
  select p.id, p.hospital_id, p.role, p.status
  from public.profiles p
  where p.id = auth.uid()
$$;

create or replace function public.is_platform_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.platform_admins pa where pa.profile_id = auth.uid()
  )
$$;

revoke all on function public.current_profile() from public;
revoke all on function public.is_platform_admin() from public;
grant execute on function public.current_profile() to authenticated;
grant execute on function public.is_platform_admin() to authenticated;

-- Deferred from 20260922000001: hospitals / hospital_modules SELECT.

create policy "hospitals_select_own_or_platform_admin"
on public.hospitals
for select
to authenticated
using (
  id = (select hospital_id from public.current_profile())
  or public.is_platform_admin()
);

create policy "hospital_modules_select_own_or_platform_admin"
on public.hospital_modules
for select
to authenticated
using (
  hospital_id = (select hospital_id from public.current_profile())
  or public.is_platform_admin()
);

-- profiles: self, same-hospital admin, or platform admin.

alter table public.profiles enable row level security;

create policy "profiles_select_self_or_admin"
on public.profiles
for select
to authenticated
using (
  id = auth.uid()
  or public.is_platform_admin()
  or (
    hospital_id = (select hospital_id from public.current_profile())
    and (select role from public.current_profile()) = 'HOSPITAL_ADMIN'
  )
);

-- platform_admins: a user can only see their own membership row, so
-- the client can cheaply answer "am I a platform admin" without being
-- able to enumerate other super admins.

alter table public.platform_admins enable row level security;

create policy "platform_admins_select_self"
on public.platform_admins
for select
to authenticated
using (profile_id = auth.uid());
