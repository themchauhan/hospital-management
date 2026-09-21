# Phase 1b — Auth, roles, RLS, tenant guard, audit foundation

This is the highest-risk phase. Use plan mode before writing migrations.

## Tasks

- [ ] Migrations: `hospitals`, `hospital_modules`, `profiles`,
      `audit_logs`
- [ ] Supabase Auth wired up: login, logout, password reset
- [ ] `profiles.role` enum: SUPER_ADMIN, HOSPITAL_ADMIN, RECEPTIONIST
- [ ] Server-side `getSessionProfile()` helper — the ONLY place
      `hospital_id` and `role` are read from, always from the
      authenticated session, never from a client-supplied value
- [ ] `requireRole(...)` and `requireActiveTenant()` server-side guards
      used on every protected route/action
- [ ] RLS policies on `hospitals`, `profiles`, `audit_logs` — a tenant
      user can only see their own hospital's rows
- [ ] `platform_admins` table/check for SUPER_ADMIN — not a nullable
      `hospital_id` trick
- [ ] Audit log helper: `logAudit(action, targetType, targetId, meta)`
      callable from any server action
- [ ] Seed script with dummy hospitals, dummy staff logins
- [ ] `hospitals.status`, `plan`, `trial_ends_at`,
      `subscription_ends_at` columns exist even though enforcement UI
      comes in Phase 8

## Tests (required, not optional)

- [ ] Happy path: each role can log in and reach its own routes
- [ ] Cross-tenant: a logged-in user from Hospital A cannot read or
      write a row belonging to Hospital B, tested directly at the DB
      level (not just through the UI)
- [ ] A request with a spoofed/forged `hospital_id` in the payload is
      rejected or ignored server-side
- [ ] No service-role key or DB credentials appear in any client
      bundle (grep the build output)

## Acceptance criteria

- Users can sign in/out
- Role-protected routes work
- Tenant users cannot query another centre's data (verified by test,
  not assumption)
- No secrets appear in client bundles
