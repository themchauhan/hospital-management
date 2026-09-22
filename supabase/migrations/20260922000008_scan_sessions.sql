-- Phase 5: phone-camera QR scanning.
--
-- The phone that scans the QR never signs in -- it has no Supabase
-- Auth session at all, so none of the RLS policies elsewhere in this
-- schema can apply to it (they all key off auth.uid() via
-- current_profile()). The brief's own answer is a bearer token scoped
-- server-side to hospital + user + patient + (optional) visit; that
-- token is the phone's only credential. Reads/writes made on the
-- strength of that token go through the service-role client (see
-- src/lib/supabase/service-role.ts's updated doc comment) after the
-- token is independently re-validated in application code against
-- this table -- so scan_sessions itself still needs full RLS (for the
-- desktop side, which IS an authenticated session) even though the
-- phone side never touches RLS directly.

create type scan_session_status as enum ('PENDING', 'COMPLETED', 'CANCELLED');

create table public.scan_sessions (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null default public.current_hospital_id()
    references public.hospitals (id) on delete restrict,
  created_by uuid not null default auth.uid() references public.profiles (id) on delete restrict,
  patient_id uuid not null,
  -- Nullable, same reasoning as documents.visit_id: a PATIENT-scope
  -- scan (e.g. ID Proof) isn't tied to one visit.
  visit_id uuid,
  document_type_id uuid not null,
  -- Only the hash is stored; the raw token lives only in the QR image
  -- and the URL fragment the phone's browser holds, never in a
  -- database row or a server log.
  token_hash text not null unique,
  status scan_session_status not null default 'PENDING',
  expires_at timestamptz not null default (now() + interval '12 minutes'),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (id, hospital_id),
  foreign key (patient_id, hospital_id) references public.patients (id, hospital_id) on delete restrict,
  foreign key (visit_id, hospital_id) references public.visits (id, hospital_id) on delete restrict,
  foreign key (document_type_id, hospital_id) references public.document_types (id, hospital_id) on delete restrict
);

create index scan_sessions_hospital_id_idx on public.scan_sessions (hospital_id);

alter table public.scan_sessions enable row level security;

create policy "scan_sessions_select_own_hospital"
on public.scan_sessions
for select
to authenticated
using (hospital_id = (select hospital_id from public.current_profile()));

create policy "scan_sessions_insert_own_hospital"
on public.scan_sessions
for insert
to authenticated
with check (
  hospital_id = (select hospital_id from public.current_profile())
  and created_by = auth.uid()
);

-- Used only for the "cancel my own stale pending session" step in
-- createScanSession -- never by the phone (which has no session to
-- run this policy under in the first place).
create policy "scan_sessions_update_own"
on public.scan_sessions
for update
to authenticated
using (
  hospital_id = (select hospital_id from public.current_profile())
  and created_by = auth.uid()
)
with check (
  hospital_id = (select hospital_id from public.current_profile())
  and created_by = auth.uid()
);

-- No DELETE policy: sessions just accumulate as small, inert rows
-- once expired/completed/cancelled -- no cron cleanup in this MVP.

-- documents.scan_session_id/page_no have existed since Phase 4 as
-- unused placeholders; wire up the real FK now that scan_sessions
-- exists.
alter table public.documents
  add constraint documents_scan_session_id_hospital_id_fkey
  foreign key (scan_session_id, hospital_id) references public.scan_sessions (id, hospital_id) on delete restrict;

create index documents_scan_session_id_idx on public.documents (scan_session_id);
