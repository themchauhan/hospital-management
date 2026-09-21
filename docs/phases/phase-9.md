# Phase 9 — Security hardening and pilot readiness

This phase gates real patient data. Do not proceed to a real pilot
until every item below is checked and legal/security review is done.

## Tasks

- [ ] Review RLS and authorization for every table and every storage
      operation; write down the review, don't just eyeball it
- [ ] Test cross-tenant access attempts systematically across every
      table and route (build a checklist table: table × operation ×
      "attempted as wrong tenant" × pass/fail)
- [ ] Audit events exist for: patient edits, visit create/edit,
      document upload/view/delete, user changes, subscription changes
- [ ] Database and Storage backup/recovery procedure documented and
      actually tested (restore a backup, don't just take one)
- [ ] File size limits enforced at every layer (client hint, server
      check, Storage bucket policy)
- [ ] Secure session settings (cookie flags, session length) reviewed
- [ ] Admin MFA confirmed working (built in Phase 1c) for all admin
      accounts before pilot
- [ ] Privacy/retention/deletion policy written per centre's
      configurable retention rules
- [ ] Incident-response procedure written: who is notified, what
      timeline, what's disclosed (DPDP Act breach-notification
      obligations become fully binding 18 months after the Rules'
      13 Nov 2025 notification — build the habit now regardless of
      exact enforcement date)
- [ ] Legal/security review completed and signed off before any real
      patient data enters the system
- [ ] Pilot runs with dummy data first; only after sign-off does a
      small controlled pilot with a real centre begin

## Acceptance criteria

- Documented security test checklist passes
- Backups/recovery are understood and have been tested at least once
- Pilot users can complete the real workflow without using real data
  prematurely
