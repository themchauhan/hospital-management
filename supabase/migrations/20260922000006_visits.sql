-- Phase 3: doctors, visit_types, visits, visit_payments.
--
-- Design notes not spelled out verbatim in docs/BRIEF.md:
-- - `visits.status` isn't enumerated anywhere in the brief for
--   general OPD (Phase 7 adds a richer examination-status workflow,
--   but that's USG-specific and later). A minimal
--   SCHEDULED/COMPLETED/CANCELLED enum covers "create, view, list
--   visits" for this phase without anticipating Phase 7's workflow.
-- - "Printable OPD slip ... visit number" implies visits need their
--   own human-facing sequential identifier the same way patients have
--   patient_code. `visit_counters`/`next_visit_number()` mirror
--   patient_code_counters/next_patient_code() exactly, as a plain
--   integer (no zero-padding -- "Visit #42" reads fine as-is).
-- - Payment status (UNPAID/PARTIAL/PAID) is explicitly "derived from
--   the sum of payments vs. fee_amount, not stored directly" per the
--   brief -- computed in the app layer from a normal RLS-scoped query,
--   deliberately NOT a database view. A view owned by the migration
--   role (which has BYPASSRLS) would silently leak cross-tenant data
--   to every viewer unless created with `security_invoker = true` --
--   easy to get wrong, so this sidesteps the whole class of mistake.
-- - Payment reversals (admin-only, per the brief) are modeled as a
--   normal visit_payments row with a negative amount and
--   is_reversal = true, never an UPDATE/DELETE of the original --
--   consistent with "receptionists can add payments, not delete
--   them" and the append-only pattern established for audit_logs.

create type visit_status as enum ('SCHEDULED', 'COMPLETED', 'CANCELLED');
create type payment_mode as enum ('CASH', 'UPI', 'CARD', 'OTHER');

create table public.doctors (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null default public.current_hospital_id()
    references public.hospitals (id) on delete restrict,
  name text not null,
  -- For a future doctor-login phase; always null for now (no doctor
  -- login exists yet, per the brief).
  profile_id uuid references public.profiles (id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, hospital_id)
);

create index doctors_hospital_id_idx on public.doctors (hospital_id);

create trigger doctors_set_updated_at
  before update on public.doctors
  for each row
  execute function public.set_updated_at();

alter table public.doctors enable row level security;

create policy "doctors_select_own_hospital"
on public.doctors
for select
to authenticated
using (hospital_id = (select hospital_id from public.current_profile()));

create policy "doctors_insert_own_hospital"
on public.doctors
for insert
to authenticated
with check (hospital_id = (select hospital_id from public.current_profile()));

create policy "doctors_update_own_hospital"
on public.doctors
for update
to authenticated
using (hospital_id = (select hospital_id from public.current_profile()))
with check (hospital_id = (select hospital_id from public.current_profile()));

-- visit_types: seeded via scripts/seed.ts (module-aware, per hospital),
-- not a migration seed -- consistent with how hospitals/staff are
-- seeded. Full admin configurability is Phase 6; this phase only
-- needs rows to create visits against.
create table public.visit_types (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null default public.current_hospital_id()
    references public.hospitals (id) on delete restrict,
  module module_type not null,
  name text not null,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, hospital_id)
);

create index visit_types_hospital_id_idx on public.visit_types (hospital_id);

create trigger visit_types_set_updated_at
  before update on public.visit_types
  for each row
  execute function public.set_updated_at();

alter table public.visit_types enable row level security;

create policy "visit_types_select_own_hospital"
on public.visit_types
for select
to authenticated
using (hospital_id = (select hospital_id from public.current_profile()));

create policy "visit_types_insert_own_hospital"
on public.visit_types
for insert
to authenticated
with check (hospital_id = (select hospital_id from public.current_profile()));

create policy "visit_types_update_own_hospital"
on public.visit_types
for update
to authenticated
using (hospital_id = (select hospital_id from public.current_profile()))
with check (hospital_id = (select hospital_id from public.current_profile()));

-- Per-hospital sequential visit number, same atomic pattern as
-- patient_code_counters/next_patient_code() (Phase 2).
create table public.visit_counters (
  hospital_id uuid primary key references public.hospitals (id) on delete cascade,
  next_number bigint not null default 1
);

create or replace function public.next_visit_number()
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hospital_id uuid := public.current_hospital_id();
  v_number bigint;
begin
  if v_hospital_id is null then
    raise exception 'next_visit_number() called with no hospital on the current session';
  end if;

  insert into public.visit_counters (hospital_id, next_number)
  values (v_hospital_id, 2)
  on conflict (hospital_id) do update
    set next_number = visit_counters.next_number + 1
  returning next_number - 1 into v_number;

  return v_number;
end;
$$;

revoke all on function public.next_visit_number() from public;
grant execute on function public.next_visit_number() to authenticated;

create table public.visits (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null default public.current_hospital_id()
    references public.hospitals (id) on delete restrict,
  visit_number bigint not null default public.next_visit_number(),
  patient_id uuid not null,
  visit_type_id uuid not null,
  doctor_id uuid,
  visit_date date not null default current_date,
  notes text,
  status visit_status not null default 'SCHEDULED',
  fee_amount numeric(10, 2) not null default 0 check (fee_amount >= 0),
  follow_up_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, hospital_id),
  unique (hospital_id, visit_number),
  -- The composite-FK pattern from Phase 2, now actually applied: a
  -- visit can never reference another hospital's patient, visit type,
  -- or doctor even from buggy application code, because the pair
  -- (foo_id, hospital_id) must exist in the referenced table.
  foreign key (patient_id, hospital_id) references public.patients (id, hospital_id) on delete restrict,
  foreign key (visit_type_id, hospital_id) references public.visit_types (id, hospital_id) on delete restrict,
  foreign key (doctor_id, hospital_id) references public.doctors (id, hospital_id) on delete set null
);

create index visits_hospital_id_idx on public.visits (hospital_id);
create index visits_patient_id_idx on public.visits (patient_id);

create trigger visits_set_updated_at
  before update on public.visits
  for each row
  execute function public.set_updated_at();

alter table public.visits enable row level security;

create policy "visits_select_own_hospital"
on public.visits
for select
to authenticated
using (hospital_id = (select hospital_id from public.current_profile()));

create policy "visits_insert_own_hospital"
on public.visits
for insert
to authenticated
with check (hospital_id = (select hospital_id from public.current_profile()));

create policy "visits_update_own_hospital"
on public.visits
for update
to authenticated
using (hospital_id = (select hospital_id from public.current_profile()))
with check (hospital_id = (select hospital_id from public.current_profile()));

-- No DELETE policy -- a visit is clinical/financial history, never
-- hard-deleted (hard rule #6 in spirit, even though visits aren't
-- explicitly named in that rule the way patients/documents are).

create table public.visit_payments (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null default public.current_hospital_id()
    references public.hospitals (id) on delete restrict,
  visit_id uuid not null,
  amount numeric(10, 2) not null,
  mode payment_mode not null,
  received_by uuid not null default auth.uid() references public.profiles (id) on delete restrict,
  received_at timestamptz not null default now(),
  note text,
  is_reversal boolean not null default false,
  created_at timestamptz not null default now(),
  foreign key (visit_id, hospital_id) references public.visits (id, hospital_id) on delete restrict
);

create index visit_payments_hospital_id_idx on public.visit_payments (hospital_id);
create index visit_payments_visit_id_idx on public.visit_payments (visit_id);

alter table public.visit_payments enable row level security;

create policy "visit_payments_select_own_hospital"
on public.visit_payments
for select
to authenticated
using (hospital_id = (select hospital_id from public.current_profile()));

-- Anyone in the hospital can record an ordinary payment; only a
-- HOSPITAL_ADMIN can record a reversal (is_reversal = true) --
-- "corrections are a reversal entry by an admin" per the brief.
create policy "visit_payments_insert_own_hospital"
on public.visit_payments
for insert
to authenticated
with check (
  hospital_id = (select hospital_id from public.current_profile())
  and received_by = auth.uid()
  and (
    is_reversal = false
    or (select role from public.current_profile()) = 'HOSPITAL_ADMIN'
  )
);

-- No UPDATE or DELETE policy at all -- append-only, matches
-- "receptionists can add payments, not delete them" and the
-- audit_logs precedent.
