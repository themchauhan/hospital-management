# Phase 7 — USG dashboard and workflow

## Tasks

- [ ] Dedicated USG dashboard for centres with the USG module:
      Today's Examinations, Waiting, Documents Pending, In Progress,
      Completed
- [ ] Create examination, check off configured documents, mark
      verification status, record examination/report status, complete
      the visit
- [ ] "USG Report" document type: reception attaches the finished
      PDF produced by the centre's existing report software (no
      report generation built here)
- [ ] Centre-configured PC-PNDT declarations/forms with version and
      effective-date tracking where applicable (scan/upload only —
      no digital form capture of content)
- [ ] Confirm no functionality anywhere determines or discloses fetal
      sex
- [ ] Daily "collection by mode and by staff" summary added to the
      USG/general dashboard (from Phase 3's payment data)

## Tests

- [ ] Examination status transitions are recorded and visible
- [ ] PC-PNDT form version/date is traceable per visit
- [ ] Cross-tenant: dashboard counts never include another hospital's
      visits

## Acceptance criteria

- Staff can see pending documentation and move an examination through
  its statuses
- Centre-specific form requirements are traceable
