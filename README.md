# Hospital & USG Management SaaS

A multi-tenant web app for small Indian hospitals and diagnostic (USG)
centres — capture patient details and documents once, reuse them on
every repeat visit. See [`docs/BRIEF.md`](docs/BRIEF.md) for the full
product spec and [`CLAUDE.md`](CLAUDE.md) for the project's hard rules
(multi-tenancy, RLS, no hard deletes, etc.).

This repo is being built phase by phase — see
[`docs/phases/`](docs/phases). Current phase: **4 — documents
(upload, view, requirements checklist)**.

## Tech stack

- [Next.js](https://nextjs.org) (App Router) + React + TypeScript
  (strict) + Tailwind CSS
- [Supabase](https://supabase.com) — Postgres, Auth, private Storage,
  accessed via `@supabase/ssr` using the signed-in user's own session
  (never a service-role client) so Row Level Security applies
- [Vitest](https://vitest.dev) for unit/integration tests (including
  RLS tests that run directly against Postgres),
  [Playwright](https://playwright.dev) for e2e tests
- Deploy target: [Vercel](https://vercel.com) (`bom1` / Mumbai region)

## Prerequisites

- [Node.js](https://nodejs.org) 22 or later (`nvm use` picks up
  `.nvmrc` if you use nvm)
- npm 10 or later
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) —
  required to run Supabase locally (`supabase start`)

The Supabase CLI is installed as a project dev dependency (`npx
supabase ...` or `npm run supabase -- ...`), so no global install is
required.

## Getting started

```bash
git clone <repo-url>
cd hospital-management
npm install
cp .env.example .env.local
npx supabase start
```

`supabase start` prints local API URL and keys — copy them into
`.env.local`:

```bash
npx supabase status -o env
# API_URL          -> NEXT_PUBLIC_SUPABASE_URL
# ANON_KEY         -> NEXT_PUBLIC_SUPABASE_ANON_KEY
# SERVICE_ROLE_KEY -> SUPABASE_SERVICE_ROLE_KEY
```

Then seed dummy hospitals/staff and start the app:

```bash
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in at
`/login` with any seeded account (see `scripts/seed.ts` for the full
list — all share the password `demo-password-123!`):

| Email                      | Role                       | Centre                                   |
| -------------------------- | -------------------------- | ---------------------------------------- |
| `super@platform.test`      | SUPER_ADMIN                | — (platform admin)                       |
| `admin@sunrise.test`       | HOSPITAL_ADMIN             | Sunrise General Hospital (GENERAL_OPD)   |
| `reception@sunrise.test`   | RECEPTIONIST               | Sunrise General Hospital                 |
| `admin@clarity.test`       | HOSPITAL_ADMIN             | Clarity Diagnostics (USG)                |
| `admin@wellspring.test`    | HOSPITAL_ADMIN             | Wellspring Multispecialty (both modules) |
| `deactivated@sunrise.test` | RECEPTIONIST (deactivated) | Sunrise General Hospital                 |

SUPER_ADMIN and HOSPITAL_ADMIN accounts require two-factor
authentication (Phase 1c) — the first sign-in for each of those
seeded accounts prompts MFA enrollment (scan the QR with any TOTP
authenticator app). RECEPTIONIST accounts don't require it.

Never commit `.env.local` or paste real Supabase secrets into a
prompt — see `CLAUDE.md` hard rule #5 on dummy data only.

### Provisioning the first SUPER_ADMIN (outside of seeding)

There's no signup route. A platform admin is always created by an
operator running:

```bash
npm run provision:super-admin -- --email you@example.com --name "Your Name"
```

This sends a Supabase invite email (check
[http://127.0.0.1:54324](http://127.0.0.1:54324) locally) so the
operator sets their own password — the script never generates or
prints one. `scripts/seed.ts` already provisions one demo platform
admin (`super@platform.test`), so you normally only need this for a
second platform admin or against a non-local project.

## Local Supabase

```bash
npx supabase start        # boot local Postgres, Auth, Storage in Docker
npx supabase status -o env  # print local API URL and keys for .env.local
npx supabase db reset      # drop and re-apply all migrations from scratch
npx supabase stop          # stop the local stack
```

Migrations live in `supabase/migrations/`. After changing one, run
`npx supabase db reset` and `npm run db:seed` again.

## Scripts

| Command                         | Purpose                                                                        |
| ------------------------------- | ------------------------------------------------------------------------------ |
| `npm run dev`                   | Start the Next.js dev server                                                   |
| `npm run build`                 | Production build (also type-checks)                                            |
| `npm run start`                 | Run the production build                                                       |
| `npm run lint`                  | ESLint                                                                         |
| `npm run typecheck`             | `tsc --noEmit`                                                                 |
| `npm run format`                | Prettier, writes changes                                                       |
| `npm run format:check`          | Prettier, check only (used in CI)                                              |
| `npm test`                      | Vitest unit tests + RLS integration tests (needs `supabase start` + `db:seed`) |
| `npm run test:watch`            | Vitest in watch mode                                                           |
| `npm run e2e`                   | Playwright e2e tests (builds and boots the app first)                          |
| `npm run db:seed`               | Seed dummy hospitals/staff into the local Supabase instance                    |
| `npm run provision:super-admin` | Invite a new SUPER_ADMIN (`-- --email ... --name ...`)                         |
| `npm run check:no-secrets`      | Grep the built client bundle for a leaked service-role key                     |

Playwright browsers must be installed once per machine:

```bash
npx playwright install chromium
```

## CI

GitHub Actions (`.github/workflows/ci.yml`) runs on every push and PR:
install → lint → typecheck → start a local Supabase instance → seed →
unit/RLS tests → build → no-secrets check, then a separate job runs
the Playwright e2e suite against a seeded local Supabase instance too.

## Project structure

```
src/app/            Next.js App Router routes, layouts, error/404 pages,
                     auth routes (login, forgot/reset password), dashboard
                     (incl. /dashboard/staff, /dashboard/patients), admin,
                     MFA setup/verify
src/components/      Shared UI components
src/lib/supabase/    Supabase clients: user-session (server.ts), browser
                     (client.ts, MFA only), the one service-role client
                     (service-role.ts), middleware helper
src/lib/auth/        getSessionProfile(), requireRole(), requireActiveTenant(),
                     getMfaStatus()
src/lib/audit/       logAudit() helper
src/types/           Hand-authored Database type (see file header re: regenerating)
docs/BRIEF.md        Full product spec
docs/phases/         Phase-by-phase task lists and acceptance criteria
supabase/            Migrations, config, email templates
scripts/seed.ts                  Dev-only dummy data seeding (service-role, via tsx)
scripts/provision-super-admin.ts Operator-run first-SUPER_ADMIN provisioning
tests/rls/           RLS integration tests, run against a real local Postgres
e2e/                 Playwright e2e tests
```

## Patients (Phase 2)

- Patient codes (`000123`) are a per-hospital sequence generated
  atomically by a `next_patient_code()` Postgres function (`INSERT ...
ON CONFLICT DO UPDATE`) — safe under concurrent registrations, see
  `supabase/migrations/20260922000005_patients.sql`.
- Search (`/dashboard/patients?q=...`) matches name (fuzzy, via
  `pg_trgm`), mobile, and patient code through a `search_patients` DB
  function; RLS still applies since it's invoker-rights, not
  `SECURITY DEFINER`.
- Creating a patient checks `possible_duplicate_patients` (mobile
  match, or similar name + non-conflicting DOB) and shows a warning —
  never a hard block — before it's saved.
- No hard deletes: `patients.deleted_at` exists but nothing sets it
  yet; there's no DELETE policy on the table at all.

## Visits & payments (Phase 3)

- `visits`/`visit_types`/`doctors` follow the same composite-FK
  pattern patients established: `(patient_id, hospital_id)`,
  `(visit_type_id, hospital_id)`, `(doctor_id, hospital_id)` all
  reference the target table's `(id, hospital_id)` pair, so a visit
  can never point at another hospital's patient/visit type/doctor even
  from a bug in application code.
- `visits.visit_number` is a per-hospital sequence (same atomic
  pattern as `patient_code`), used on the printable OPD slip
  (`/dashboard/visits/[id]/slip`, opens in a new tab, hides the nav
  via Tailwind's `print:` variant).
- Payment status (UNPAID/PARTIAL/PAID) is derived at read time from
  `sum(visit_payments.amount) vs. visits.fee_amount` — never stored.
  Corrections are a separate `is_reversal = true` row with a negative
  amount, insertable only by HOSPITAL_ADMIN (RLS-enforced); no
  UPDATE/DELETE policy exists on `visit_payments` at all.
- `dashboard/layout.tsx` threads the actual requested path through
  `x-pathname` (set in `middleware.ts`) so the MFA gate returns the
  user to the page they asked for, not always `/dashboard` — a real
  bug caught by an e2e test rather than a hand-wave.

## Documents (Phase 4)

- Two document tables mirror how the brief distinguishes a
  configurable rule from its immutable history:
  `visit_type_document_requirements` is the admin-editable rule
  ("OPD Consultation requires an ID Proof", Phase 6 UI);
  `visit_document_requirements` is a snapshot of that rule copied onto
  a specific visit **by a database trigger** at insert time, so later
  changes to the rule never rewrite the record of a past visit — and
  the snapshot happens for every insert into `visits` regardless of
  which code path creates the row, not just `createVisit()`.
- `document_types.scope` (`PATIENT` or `VISIT`) is what lets a
  document like ID Proof be captured once on a patient and
  automatically satisfy the same requirement on every visit, instead
  of being re-uploaded each time; a visit's checklist is fulfilled by
  any document of that type at either the visit or the patient level.
- Uploads are validated server-side by magic bytes
  (`src/lib/documents/file-validation.ts`), never by the
  browser-supplied extension/MIME header, and images are re-encoded
  through `sharp` to strip EXIF metadata before they ever reach
  Storage.
- The `documents` Storage bucket is fully private; every read goes
  through a signed URL (60s TTL) minted server-side by
  `getDocumentViewUrl()`, which only runs after the caller's own RLS
  already scoped the `documents` row to their hospital. Viewing a
  document flagged `sensitive` (e.g. ID Proof) writes an
  `audit_logs` row.
- `/dashboard/documents` ("Pending documents") lists every visit still
  missing a required document across the hospital — the safety net
  the brief calls for so nothing is silently lost.
- A real bug an e2e test caught: `ViewDocumentButton` opened a blank
  tab synchronously (to survive the click gesture past an `await`)
  with `window.open(..., "noopener")` and kept the returned reference
  to redirect it later — but `noopener` makes Chromium return `null`,
  so the reference-based redirect silently no-opped and the tab stayed
  on `about:blank` forever. Fixed by targeting a named window instead
  of holding a reference (`window.open("", name)` then later
  `window.open(url, name, "noopener,noreferrer")`), which needs no
  reference at all.

## Deployment notes

Not yet configured — deployment to Vercel (Mumbai/`bom1` region) lands
once more of the core document workflow exists (Phase 4+).
