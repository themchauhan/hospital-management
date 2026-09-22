-- Phase 7: USG examination workflow status and PC-PNDT declaration
-- tracking.
--
-- No RLS changes needed: visits_update_own_hospital (Phase 3) already
-- lets any hospital staff move a visit through its status; the
-- document_types insert/update policies (tightened to HOSPITAL_ADMIN
-- in Phase 6) already cover creating/superseding a PC-PNDT
-- declaration type the same way any other document type is created.

alter type visit_status add value 'IN_PROGRESS';

-- document_types.version/effective_from have existed unused since the
-- Phase 4 migration for exactly this purpose (see its own comment).
-- This flag is what lets the app find "the current PC-PNDT
-- declaration type(s)" for a hospital without guessing from a name.
alter table public.document_types add column pc_pndt_form boolean not null default false;
