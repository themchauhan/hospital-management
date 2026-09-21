-- Phase 1c: let a HOSPITAL_ADMIN activate/deactivate their own
-- hospital's staff (soft, via profiles.status) directly through RLS,
-- restricted to only the `status` column via column-level GRANT --
-- Postgres RLS alone can't restrict which columns an UPDATE touches,
-- so the column grant is what stops this policy from being (mis)used
-- to rewrite a profile's role or hospital_id.

revoke update on public.profiles from authenticated;
grant update (status) on public.profiles to authenticated;

create policy "profiles_update_status_by_admin_same_hospital"
on public.profiles
for update
to authenticated
using (
  hospital_id = (select hospital_id from public.current_profile())
  and (select role from public.current_profile()) = 'HOSPITAL_ADMIN'
  and role <> 'SUPER_ADMIN'
)
with check (
  hospital_id = (select hospital_id from public.current_profile())
  and role <> 'SUPER_ADMIN'
);
