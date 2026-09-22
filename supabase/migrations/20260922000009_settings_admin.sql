-- Phase 6: admin-editable modules, visit types, document types, and
-- document requirements. These tables were deliberately seed/service-
-- role-only (or, for visit_types/document_types/vtdr, writable by any
-- authenticated hospital staff with no role check) until now -- see
-- the Phase 1b and Phase 4 migration comments. This migration adds
-- the missing write policies and tightens the existing ones to
-- HOSPITAL_ADMIN specifically, since that's the only role this admin
-- UI is for and RLS should say so independently of the app layer.

alter table public.visit_types add column default_fee numeric(10, 2);

-- hospital_modules: no write policy existed at all. Disabling a
-- module is a DELETE (no soft-delete column on this table -- it's
-- hospital configuration, not patient/clinical data, so hard rule #6
-- doesn't apply here); enabling is an INSERT. No UPDATE policy is
-- needed since the only mutable fact is "does this row exist."
create policy "hospital_modules_insert_own_hospital"
on public.hospital_modules
for insert
to authenticated
with check (
  hospital_id = (select hospital_id from public.current_profile())
  and (select role from public.current_profile()) = 'HOSPITAL_ADMIN'
);

create policy "hospital_modules_delete_own_hospital"
on public.hospital_modules
for delete
to authenticated
using (
  hospital_id = (select hospital_id from public.current_profile())
  and (select role from public.current_profile()) = 'HOSPITAL_ADMIN'
);

-- visit_types: tighten existing insert/update policies to
-- HOSPITAL_ADMIN only (previously any authenticated hospital staff).
drop policy "visit_types_insert_own_hospital" on public.visit_types;
create policy "visit_types_insert_own_hospital"
on public.visit_types
for insert
to authenticated
with check (
  hospital_id = (select hospital_id from public.current_profile())
  and (select role from public.current_profile()) = 'HOSPITAL_ADMIN'
);

drop policy "visit_types_update_own_hospital" on public.visit_types;
create policy "visit_types_update_own_hospital"
on public.visit_types
for update
to authenticated
using (
  hospital_id = (select hospital_id from public.current_profile())
  and (select role from public.current_profile()) = 'HOSPITAL_ADMIN'
)
with check (
  hospital_id = (select hospital_id from public.current_profile())
  and (select role from public.current_profile()) = 'HOSPITAL_ADMIN'
);

-- document_types: same tightening.
drop policy "document_types_insert_own_hospital" on public.document_types;
create policy "document_types_insert_own_hospital"
on public.document_types
for insert
to authenticated
with check (
  hospital_id = (select hospital_id from public.current_profile())
  and (select role from public.current_profile()) = 'HOSPITAL_ADMIN'
);

drop policy "document_types_update_own_hospital" on public.document_types;
create policy "document_types_update_own_hospital"
on public.document_types
for update
to authenticated
using (
  hospital_id = (select hospital_id from public.current_profile())
  and (select role from public.current_profile()) = 'HOSPITAL_ADMIN'
)
with check (
  hospital_id = (select hospital_id from public.current_profile())
  and (select role from public.current_profile()) = 'HOSPITAL_ADMIN'
);

-- visit_type_document_requirements: same tightening on insert/delete,
-- plus a new update policy (didn't exist before) so `required` can be
-- toggled in place instead of a delete+reinsert dance.
drop policy "vtdr_insert_own_hospital" on public.visit_type_document_requirements;
create policy "vtdr_insert_own_hospital"
on public.visit_type_document_requirements
for insert
to authenticated
with check (
  hospital_id = (select hospital_id from public.current_profile())
  and (select role from public.current_profile()) = 'HOSPITAL_ADMIN'
);

drop policy "vtdr_delete_own_hospital" on public.visit_type_document_requirements;
create policy "vtdr_delete_own_hospital"
on public.visit_type_document_requirements
for delete
to authenticated
using (
  hospital_id = (select hospital_id from public.current_profile())
  and (select role from public.current_profile()) = 'HOSPITAL_ADMIN'
);

create policy "vtdr_update_own_hospital"
on public.visit_type_document_requirements
for update
to authenticated
using (
  hospital_id = (select hospital_id from public.current_profile())
  and (select role from public.current_profile()) = 'HOSPITAL_ADMIN'
)
with check (
  hospital_id = (select hospital_id from public.current_profile())
  and (select role from public.current_profile()) = 'HOSPITAL_ADMIN'
);
