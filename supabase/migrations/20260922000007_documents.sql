-- Phase 4: document_types, visit-type document requirements (+ their
-- per-visit snapshot), documents, and private Storage.
--
-- Design notes not spelled out verbatim in docs/BRIEF.md:
-- - No id-number column anywhere: the brief's core data model doesn't
--   list one on `documents`, and "if captured as text at all, stored
--   outside any generally searchable column" reads as permission, not
--   a requirement -- the safest reading given "the image itself is
--   the source of truth" is to not transcribe it at all in this MVP.
-- - `visit_type_document_requirements` is the admin-configurable rule
--   ("General USG requires an ID Proof"); `visit_document_requirements`
--   is the immutable snapshot of that rule copied onto a specific
--   visit at creation time, per the brief ("Checklist requirements
--   are copied onto each visit at creation... so later configuration
--   changes never rewrite the history of past visits"). Two tables,
--   not one, because their lifecycles are genuinely different: the
--   first changes over time (Phase 6 UI), the second never does.
-- - Storage RLS mirrors the Postgres RLS pattern (scoped by the first
--   path segment, which is hospital_id per the brief's storage path
--   convention) as defense in depth for the upload path. Reads never
--   rely on a client having direct bucket access at all -- the bucket
--   is fully private and every read goes through a short-lived signed
--   URL minted server-side by a request that already had to pass the
--   `documents` table's own RLS to learn the storage_path in the
--   first place.

create type document_scope as enum ('PATIENT', 'VISIT');

create table public.document_types (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null default public.current_hospital_id()
    references public.hospitals (id) on delete restrict,
  name text not null,
  description text,
  scope document_scope not null,
  sensitive boolean not null default false,
  active boolean not null default true,
  version integer not null default 1,
  effective_from date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, hospital_id)
);

create index document_types_hospital_id_idx on public.document_types (hospital_id);

create trigger document_types_set_updated_at
  before update on public.document_types
  for each row
  execute function public.set_updated_at();

alter table public.document_types enable row level security;

create policy "document_types_select_own_hospital"
on public.document_types
for select
to authenticated
using (hospital_id = (select hospital_id from public.current_profile()));

create policy "document_types_insert_own_hospital"
on public.document_types
for insert
to authenticated
with check (hospital_id = (select hospital_id from public.current_profile()));

create policy "document_types_update_own_hospital"
on public.document_types
for update
to authenticated
using (hospital_id = (select hospital_id from public.current_profile()))
with check (hospital_id = (select hospital_id from public.current_profile()));

-- The configurable rule: which document types a visit type expects.
-- Phase 6 builds the admin UI to edit these; Phase 4 only needs them
-- to exist so a visit can snapshot them at creation time.
create table public.visit_type_document_requirements (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null default public.current_hospital_id()
    references public.hospitals (id) on delete restrict,
  visit_type_id uuid not null,
  document_type_id uuid not null,
  required boolean not null default true,
  created_at timestamptz not null default now(),
  unique (visit_type_id, document_type_id),
  foreign key (visit_type_id, hospital_id) references public.visit_types (id, hospital_id) on delete cascade,
  foreign key (document_type_id, hospital_id) references public.document_types (id, hospital_id) on delete cascade
);

create index vtdr_hospital_id_idx on public.visit_type_document_requirements (hospital_id);

alter table public.visit_type_document_requirements enable row level security;

create policy "vtdr_select_own_hospital"
on public.visit_type_document_requirements
for select
to authenticated
using (hospital_id = (select hospital_id from public.current_profile()));

create policy "vtdr_insert_own_hospital"
on public.visit_type_document_requirements
for insert
to authenticated
with check (hospital_id = (select hospital_id from public.current_profile()));

create policy "vtdr_delete_own_hospital"
on public.visit_type_document_requirements
for delete
to authenticated
using (hospital_id = (select hospital_id from public.current_profile()));

-- The immutable snapshot, copied from the above at visit-creation
-- time by a trigger (below), not application code -- so it happens
-- for every insert into `visits` regardless of which code path
-- creates the row, not just the one the app's createVisit() action
-- happens to know about. Never edited after the fact -- no UPDATE
-- policy.
create table public.visit_document_requirements (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null default public.current_hospital_id()
    references public.hospitals (id) on delete restrict,
  visit_id uuid not null,
  document_type_id uuid not null,
  document_type_name text not null,
  required boolean not null default true,
  created_at timestamptz not null default now(),
  foreign key (visit_id, hospital_id) references public.visits (id, hospital_id) on delete cascade,
  foreign key (document_type_id, hospital_id) references public.document_types (id, hospital_id) on delete restrict
);

create index vdr_hospital_id_idx on public.visit_document_requirements (hospital_id);
create index vdr_visit_id_idx on public.visit_document_requirements (visit_id);

alter table public.visit_document_requirements enable row level security;

create policy "vdr_select_own_hospital"
on public.visit_document_requirements
for select
to authenticated
using (hospital_id = (select hospital_id from public.current_profile()));

create policy "vdr_insert_own_hospital"
on public.visit_document_requirements
for insert
to authenticated
with check (hospital_id = (select hospital_id from public.current_profile()));

-- SECURITY INVOKER (the default): runs as whoever's INSERT into
-- `visits` fired it, so the insert below is still subject to (and
-- must satisfy) vdr_insert_own_hospital above -- this trigger doesn't
-- bypass RLS, it just guarantees the snapshot happens at all.
create or replace function public.snapshot_visit_document_requirements()
returns trigger
language plpgsql
as $$
begin
  insert into public.visit_document_requirements
    (hospital_id, visit_id, document_type_id, document_type_name, required)
  select vtdr.hospital_id, new.id, vtdr.document_type_id, dt.name, vtdr.required
  from public.visit_type_document_requirements vtdr
  join public.document_types dt on dt.id = vtdr.document_type_id
  where vtdr.visit_type_id = new.visit_type_id;
  return new;
end;
$$;

create trigger visits_snapshot_document_requirements
  after insert on public.visits
  for each row
  execute function public.snapshot_visit_document_requirements();

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null default public.current_hospital_id()
    references public.hospitals (id) on delete restrict,
  patient_id uuid not null,
  -- Nullable: PATIENT-scope documents (e.g. ID Proof) aren't tied to
  -- one visit.
  visit_id uuid,
  document_type_id uuid not null,
  file_name text not null,
  file_type text not null,
  storage_path text not null,
  file_size bigint not null,
  sha256 text not null,
  -- Both unused until Phase 5 (phone-camera multi-page scanning) --
  -- present now because the brief's core data model fixes this
  -- table's full shape up front, not because Phase 5 is being built
  -- early.
  page_no integer,
  scan_session_id uuid,
  uploaded_by uuid not null default auth.uid() references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  foreign key (patient_id, hospital_id) references public.patients (id, hospital_id) on delete restrict,
  foreign key (visit_id, hospital_id) references public.visits (id, hospital_id) on delete restrict,
  foreign key (document_type_id, hospital_id) references public.document_types (id, hospital_id) on delete restrict
);

create index documents_hospital_id_idx on public.documents (hospital_id);
create index documents_patient_id_idx on public.documents (patient_id);
create index documents_visit_id_idx on public.documents (visit_id);

alter table public.documents enable row level security;

create policy "documents_select_own_hospital"
on public.documents
for select
to authenticated
using (hospital_id = (select hospital_id from public.current_profile()));

create policy "documents_insert_own_hospital"
on public.documents
for insert
to authenticated
with check (
  hospital_id = (select hospital_id from public.current_profile())
  and uploaded_by = auth.uid()
);

-- No UPDATE/DELETE policy -- documents are soft-deleted only (hard
-- rule #6), and there's no delete UI in this phase at all yet, so
-- deleted_at exists in the schema but nothing sets it.

-- Private bucket: every read goes through a signed URL minted by
-- getDocumentViewUrl() (server-side, user's own session, RLS-checked
-- against the `documents` row first).
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

create policy "documents_bucket_select_own_hospital"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'documents'
  and (storage.foldername(name))[1] = (select hospital_id::text from public.current_profile())
);

create policy "documents_bucket_insert_own_hospital"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'documents'
  and (storage.foldername(name))[1] = (select hospital_id::text from public.current_profile())
);
