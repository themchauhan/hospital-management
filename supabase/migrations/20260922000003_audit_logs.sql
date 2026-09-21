-- Phase 1b: audit_logs -- append-only, no UPDATE/DELETE policy ever.

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  -- Nullable: a platform-admin action not tied to one hospital is
  -- legitimate. Every tenant-scoped action always has this set by
  -- logAudit(), which derives it server-side and never accepts it as
  -- an argument.
  hospital_id uuid references public.hospitals (id) on delete restrict,
  -- Defaults to the caller's own id so a client-supplied user_id can
  -- never impersonate another user, the same defense-in-depth pattern
  -- as hospital_id above. logAudit() sets it explicitly anyway, but
  -- the database doesn't rely on that.
  user_id uuid not null default auth.uid() references public.profiles (id) on delete restrict,
  action text not null,
  target_type text not null,
  target_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.audit_logs is
  'Append-only audit trail. No UPDATE or DELETE policy exists for '
  'any role -- enforced at the database level, not just by convention.';

create index audit_logs_hospital_id_idx on public.audit_logs (hospital_id);
create index audit_logs_created_at_idx on public.audit_logs (created_at desc);

alter table public.audit_logs enable row level security;

create policy "audit_logs_select_own_or_platform_admin"
on public.audit_logs
for select
to authenticated
using (
  public.is_platform_admin()
  or hospital_id = (select hospital_id from public.current_profile())
);

-- WITH CHECK is defense in depth: logAudit() always derives
-- hospital_id/user_id from the caller's own session server-side, but
-- the database enforces the same constraints independently of
-- application code -- including against a caller who explicitly sets
-- user_id in the insert payload rather than relying on its default.
create policy "audit_logs_insert_own_hospital_or_platform_admin"
on public.audit_logs
for insert
to authenticated
with check (
  user_id = auth.uid()
  and (
    hospital_id = (select hospital_id from public.current_profile())
    or (hospital_id is null and public.is_platform_admin())
  )
);
