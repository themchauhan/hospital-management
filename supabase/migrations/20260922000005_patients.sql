-- Phase 2: patients.
--
-- Design notes not spelled out verbatim in docs/BRIEF.md, recorded
-- here rather than silently guessed:
-- - patient_code is a plain zero-padded per-hospital sequence
--   ("000123"), no hospital-prefix -- the brief never specifies a
--   prefix scheme, and a bare number is simplest to get right
--   concurrently. Easy to change the formatting later without
--   touching the concurrency-safe generation mechanism itself.
-- - `approximate_age_years` (nullable) is added alongside nullable
--   `dob`: the brief says "dob nullable -- allow approximate age when
--   unknown", which only makes sense as a real feature if there's
--   somewhere to put that approximate age.
-- - Platform admins (SUPER_ADMIN) do NOT get blanket SELECT on
--   patients the way they do on hospitals/profiles/audit_logs --
--   patient records are clinical PII with no stated platform-admin
--   need to browse them, so the RLS policy is tenant-only.

create extension if not exists pg_trgm;

create type patient_gender as enum ('MALE', 'FEMALE', 'OTHER');

-- A plain "default (select hospital_id from current_profile())" on a
-- column isn't allowed -- Postgres rejects a bare subquery in a
-- DEFAULT expression -- so this thin wrapper exists to be used as a
-- function-call default instead. SECURITY DEFINER, same reasoning as
-- current_profile() itself: it only ever returns the caller's own
-- hospital_id, so elevating privilege here doesn't leak anything.
create or replace function public.current_hospital_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select hospital_id from public.current_profile()
$$;

revoke all on function public.current_hospital_id() from public;
grant execute on function public.current_hospital_id() to authenticated;

-- One row per hospital; only ever touched via next_patient_code()
-- below, never directly by `authenticated`.
create table public.patient_code_counters (
  hospital_id uuid primary key references public.hospitals (id) on delete cascade,
  next_number bigint not null default 1
);

-- SECURITY DEFINER so it can write patient_code_counters (which has
-- no grants to `authenticated` at all) while still deriving
-- hospital_id from the caller's own session -- never a parameter, so
-- there's no hospital_id to forge.
create or replace function public.next_patient_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hospital_id uuid := public.current_hospital_id();
  v_number bigint;
begin
  if v_hospital_id is null then
    raise exception 'next_patient_code() called with no hospital on the current session';
  end if;

  -- Atomic under concurrency: Postgres serializes concurrent
  -- INSERT ... ON CONFLICT DO UPDATE against the same row, so two
  -- simultaneous registrations can never read-then-write the same
  -- next_number (the classic race a plain SELECT max()+1 has).
  insert into public.patient_code_counters (hospital_id, next_number)
  values (v_hospital_id, 2)
  on conflict (hospital_id) do update
    set next_number = patient_code_counters.next_number + 1
  returning next_number - 1 into v_number;

  return lpad(v_number::text, 6, '0');
end;
$$;

revoke all on function public.next_patient_code() from public;
grant execute on function public.next_patient_code() to authenticated;

create table public.patients (
  id uuid primary key default gen_random_uuid(),
  -- Defaults to the caller's own hospital, same defense-in-depth
  -- pattern as audit_logs.user_id: the app always sets this
  -- explicitly too (per hard rule #2), but a caller who omits it
  -- can't end up with a NULL/wrong hospital_id, and the INSERT policy
  -- below still independently rejects an explicit forged value.
  hospital_id uuid not null default public.current_hospital_id()
    references public.hospitals (id) on delete restrict,
  patient_code text not null default public.next_patient_code(),
  name text not null,
  mobile text,
  dob date,
  approximate_age_years smallint,
  guardian_name text,
  gender patient_gender,
  address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (hospital_id, patient_code),
  -- The composite-FK anchor: every later table that references a
  -- patient (visits, documents, ...) references (patient_id,
  -- hospital_id) against this, not just patient_id, so a row can
  -- never point at another hospital's patient even from buggy
  -- application code. `id` alone is already globally unique (PK);
  -- this unique constraint just makes the pair a valid FK target.
  unique (id, hospital_id)
);

comment on table public.patients is
  'Never hard-deleted -- deleted_at is the only removal mechanism.';

create index patients_hospital_id_idx on public.patients (hospital_id);
create index patients_name_trgm_idx on public.patients using gin (name gin_trgm_ops);
create index patients_mobile_idx on public.patients (mobile);

create trigger patients_set_updated_at
  before update on public.patients
  for each row
  execute function public.set_updated_at();

alter table public.patients enable row level security;

create policy "patients_select_own_hospital"
on public.patients
for select
to authenticated
using (hospital_id = (select hospital_id from public.current_profile()));

create policy "patients_insert_own_hospital"
on public.patients
for insert
to authenticated
with check (hospital_id = (select hospital_id from public.current_profile()));

create policy "patients_update_own_hospital"
on public.patients
for update
to authenticated
using (hospital_id = (select hospital_id from public.current_profile()))
with check (hospital_id = (select hospital_id from public.current_profile()));

-- No DELETE policy at all -- hard rule #6, no hard deletes on
-- patient-related data. "Deleting" a patient is a future soft-delete
-- action (set deleted_at), not in this phase's scope.

-- Fuzzy + exact search in one function, invoker-rights (no SECURITY
-- DEFINER) so the patients RLS policy above still applies to its
-- result set -- this only encapsulates the matching SQL, it doesn't
-- bypass tenant isolation.
create or replace function public.search_patients(p_query text)
returns setof public.patients
language sql
stable
as $$
  select *
  from public.patients
  where deleted_at is null
    and (
      name ilike '%' || p_query || '%'
      or mobile ilike '%' || p_query || '%'
      or patient_code ilike '%' || p_query || '%'
      or similarity(name, p_query) > 0.25
    )
  order by similarity(name, p_query) desc, name asc
  limit 50
$$;

revoke all on function public.search_patients(text) from public;
grant execute on function public.search_patients(text) to authenticated;

-- Duplicate-warning heuristic for the create-patient form ("based on
-- name + mobile + approximate DOB match... don't hard-block, just
-- warn" per the brief). A match on mobile alone is already a useful
-- signal to surface (families sharing a mobile is normal, but staff
-- should still see "someone with this number already exists" so they
-- can tell at a glance whether it's the same person). A name-based
-- match additionally requires DOB to not clearly conflict, to keep
-- the common-name false-positive rate down. Same invoker-rights
-- pattern as search_patients.
create or replace function public.possible_duplicate_patients(p_name text, p_mobile text, p_dob date)
returns setof public.patients
language sql
stable
as $$
  select *
  from public.patients
  where deleted_at is null
    and (
      (p_mobile is not null and p_mobile <> '' and mobile = p_mobile)
      or (
        p_name is not null and p_name <> ''
        and similarity(name, p_name) > 0.5
        and (p_dob is null or dob is null or abs(extract(year from age(dob, p_dob))) <= 2)
      )
    )
  limit 10
$$;

revoke all on function public.possible_duplicate_patients(text, text, date) from public;
grant execute on function public.possible_duplicate_patients(text, text, date) to authenticated;
