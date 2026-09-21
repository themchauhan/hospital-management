# Phase 2 — Patient records

## Tasks

- [ ] `patients` table + RLS (composite FK pattern established here
      for later tables to follow)
- [ ] Patient code generator: per-hospital counter row, not
      `max()+1` (must not race under concurrent registrations)
- [ ] Create/edit/view patient screens
- [ ] Searchable patient list: name, mobile, patient code, partial
      matching (`pg_trgm` for fuzzy name search — handle Roman/
      Devanagari/Gurmukhi spelling variance)
- [ ] Duplicate warning before creating a new record, based on name +
      mobile + approximate DOB match (families often share mobiles —
      don't hard-block, just warn)
- [ ] DOB optional; allow approximate age when unknown
- [ ] `guardian_name` field
- [ ] Patient profile page with demographics and a placeholder area
      for visits/documents (populated in later phases)

## Tests

- [ ] Happy path: create a patient, find them by each search method,
      open the same profile
- [ ] Cross-tenant: Hospital A's receptionist cannot see or search
      Hospital B's patients
- [ ] Concurrent registration does not produce duplicate patient codes

## Acceptance criteria

- Receptionist can create a patient, find them again, open the same
  profile, and avoid re-entering basic details on repeat visits
