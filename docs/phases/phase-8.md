# Phase 8 — Super admin dashboard and manual subscriptions

Most of the enforcement plumbing (`hospitals.status`, `plan`,
`trial_ends_at`, `subscription_ends_at`, and the `requireActiveTenant`
guard) was built in Phase 1b. This phase is mostly UI plus the
payments-to-the-platform record-keeping.

## Tasks

- [ ] Super Admin dashboard: centre counts/statuses, centre list
- [ ] Create/activate/suspend a centre, change plan, change expiry,
      manually extend subscription
- [ ] `subscription_payments` table — record offline UPI/bank
      payments manually (no gateway integration)
- [ ] Confirm `requireActiveTenant()` is enforced on every protected
      route/action, not just the dashboard
- [ ] Expired/suspended tenants get a restricted/read-only state —
      data is preserved, never deleted
- [ ] Audit log entries for every subscription state change

## Tests

- [ ] Only SUPER_ADMIN can change subscription state (tested at the
      RLS/server level, not just hidden in the UI)
- [ ] Expiry is enforced server-side even if the client is bypassed
- [ ] Expired/suspended tenant's data is fully intact and viewable
      once reactivated

## Acceptance criteria

- Only SUPER_ADMIN can change subscription state
- Expiry is enforced server-side
- No tenant data is deleted due to expiry
