# Phase 1c — Super admin provisioning, staff invites, MFA

## Tasks

- [ ] Secure one-time way to provision the first SUPER_ADMIN (e.g. a
      CLI script using the service-role key, run manually — never a
      public signup route)
- [ ] HOSPITAL_ADMIN can invite staff (RECEPTIONIST, other
      HOSPITAL_ADMIN) via email invite, scoped to their own hospital_id
      server-side
- [ ] Staff account activate/deactivate (soft, not delete)
- [ ] TOTP-based MFA enabled for SUPER_ADMIN and HOSPITAL_ADMIN roles

## Tests

- [ ] An invited staff account is created with the inviting admin's
      hospital_id, never a client-supplied one
- [ ] A deactivated staff account cannot log in
- [ ] MFA is enforced on next login for the roles above

## Acceptance criteria

- A brand-new hospital can be provisioned end-to-end: SUPER_ADMIN
  creates the hospital, an admin account is invited, that admin logs
  in and invites a receptionist
