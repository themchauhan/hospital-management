# Phase 6 — Configurable visit types & document requirements

## Tasks

- [ ] Admin UI: enable/disable modules per hospital
      (GENERAL_OPD / USG)
- [ ] Admin UI: create/edit visit types per enabled module (e.g.
      General USG, Pregnancy/Obstetric USG, Abdomen & Pelvis, KUB,
      centre-defined types)
- [ ] Admin UI: create/edit document types and mark
      required/optional per visit type
- [ ] `visit_types.default_fee` — auto-fills `visits.fee_amount`,
      still editable per visit with a note
- [ ] Selected visit type dynamically shows its configured checklist
      on visit creation — no hard-coded universal requirements
      anywhere in the code
- [ ] Confirm checklist snapshotting (from Phase 4) means editing a
      visit type's requirements does not change already-created visits

## Tests

- [ ] Changing a visit type's requirements changes the checklist for
      new visits only, not existing ones
- [ ] Changing one visit type's requirements does not affect any
      other visit type
- [ ] Cross-tenant: Hospital A cannot edit Hospital B's visit types

## Acceptance criteria

- Changing an examination's requirements changes the checklist for
  new visits without changing unrelated examination types or past
  visits
