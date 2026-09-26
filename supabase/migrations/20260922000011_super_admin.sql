-- Phase 8: super admin dashboard & manual subscriptions.
--
-- hospitals/hospital_modules have had zero write policies since
-- Phase 1b, by design ("writes only ever happen via the service-role
-- client... or the provisioning module") -- this migration adds the
-- real write path: a verified platform admin, using their own
-- session (no service-role needed for these tables).

create table public.subscription_payments (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references public.hospitals (id) on delete restrict,
  amount numeric(10, 2) not null,
  payment_date date not null default current_date,
  -- Payment method values are never enumerated in the brief (same
  -- reasoning as hospitals.plan being plain text since Phase 1b), so
  -- this stays a plain string rather than an invented enum.
  payment_method text not null,
  reference_number text,
  period_start date not null,
  period_end date not null,
  notes text,
  -- Corrections are a new row with a negative amount, same pattern as
  -- visit_payments -- never edited in place.
  is_reversal boolean not null default false,
  recorded_by uuid not null default auth.uid() references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now()
);

create index subscription_payments_hospital_id_idx on public.subscription_payments (hospital_id);

alter table public.subscription_payments enable row level security;

create policy "subscription_payments_select_platform_admin"
on public.subscription_payments
for select
to authenticated
using (public.is_platform_admin());

create policy "subscription_payments_insert_platform_admin"
on public.subscription_payments
for insert
to authenticated
with check (public.is_platform_admin());

-- No UPDATE/DELETE policy at all -- append-only, matching every other
-- financial ledger in this app.

create policy "hospitals_insert_platform_admin"
on public.hospitals
for insert
to authenticated
with check (public.is_platform_admin());

create policy "hospitals_update_platform_admin"
on public.hospitals
for update
to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

-- Second policy alongside the existing Phase 6 HOSPITAL_ADMIN-scoped
-- ones (Postgres ORs multiple policies together) -- needed so a
-- platform admin can enable modules while creating a new centre,
-- which isn't their own hospital.
create policy "hospital_modules_insert_platform_admin"
on public.hospital_modules
for insert
to authenticated
with check (public.is_platform_admin());

create policy "hospital_modules_delete_platform_admin"
on public.hospital_modules
for delete
to authenticated
using (public.is_platform_admin());

-- audit_logs: the Phase 1b policy only let a platform admin write a
-- NULL-hospital_id row. Loosen it so a "suspended hospital X" action
-- can be logged against hospital X directly -- that hospital's own
-- staff can then see it via the existing SELECT policy (own
-- hospital_id), which is good transparency.
drop policy "audit_logs_insert_own_hospital_or_platform_admin" on public.audit_logs;
create policy "audit_logs_insert_own_hospital_or_platform_admin"
on public.audit_logs
for insert
to authenticated
with check (
  user_id = auth.uid()
  and (
    hospital_id = (select hospital_id from public.current_profile())
    or public.is_platform_admin()
  )
);
