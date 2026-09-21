# Phase 5 — Phone-camera QR scanning

This is the headline feature for both ID capture and slip scanning.

## Tasks

- [ ] "Scan with Phone" button on a patient/visit page creates a
      short-lived QR session
- [ ] Session token: long random value, only its hash stored,
      expires in 10–15 minutes, single-use, rate-limited
- [ ] Token is scoped server-side to hospital + user + patient +
      (optional) visit — the phone's capture page has no other
      credential
- [ ] Mobile-responsive capture page, no app install required; start
      with `<input type="file" accept="image/*" capture="environment">`
      for broad compatibility, live camera preview can follow later
- [ ] Camera capture, preview, retake, confirm
- [ ] Upload directly into the linked patient/visit via the same
      Storage path convention as Phase 4
- [ ] Desktop shows upload completion via polling (2–3s interval) —
      no Realtime needed for MVP
- [ ] Support multiple pages per session; reorder/delete/retake;
      optionally combine pages into a single PDF if feasible
- [ ] Session is invalidated immediately after use or on expiry

## Tests

- [ ] An expired session token is rejected
- [ ] A used (completed) session token cannot be reused
- [ ] A session scoped to Patient X cannot upload against Patient Y
- [ ] Cross-tenant: a leaked token from Hospital A does not work
      against Hospital B's data (shouldn't be reachable in the first
      place, but test it)

## Acceptance criteria

- No WhatsApp/manual transfer is required
- Session is time-limited, scoped to the intended hospital/user/
  patient/visit, and invalidated after use or expiry
