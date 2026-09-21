# Hospital & USG Management SaaS

A multi-tenant web app for small Indian hospitals and diagnostic (USG)
centres — capture patient details and documents once, reuse them on
every repeat visit. See [`docs/BRIEF.md`](docs/BRIEF.md) for the full
product spec and [`CLAUDE.md`](CLAUDE.md) for the project's hard rules
(multi-tenancy, RLS, no hard deletes, etc.).

This repo is being built phase by phase — see
[`docs/phases/`](docs/phases). Current phase: **1b — auth, roles, RLS,
tenant guard, audit foundation**.

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

| Email                    | Role           | Centre                                   |
| ------------------------ | -------------- | ---------------------------------------- |
| `super@platform.test`    | SUPER_ADMIN    | — (platform admin)                       |
| `admin@sunrise.test`     | HOSPITAL_ADMIN | Sunrise General Hospital (GENERAL_OPD)   |
| `reception@sunrise.test` | RECEPTIONIST   | Sunrise General Hospital                 |
| `admin@clarity.test`     | HOSPITAL_ADMIN | Clarity Diagnostics (USG)                |
| `admin@wellspring.test`  | HOSPITAL_ADMIN | Wellspring Multispecialty (both modules) |

Never commit `.env.local` or paste real Supabase secrets into a
prompt — see `CLAUDE.md` hard rule #5 on dummy data only.

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

| Command                    | Purpose                                                                        |
| -------------------------- | ------------------------------------------------------------------------------ |
| `npm run dev`              | Start the Next.js dev server                                                   |
| `npm run build`            | Production build (also type-checks)                                            |
| `npm run start`            | Run the production build                                                       |
| `npm run lint`             | ESLint                                                                         |
| `npm run typecheck`        | `tsc --noEmit`                                                                 |
| `npm run format`           | Prettier, writes changes                                                       |
| `npm run format:check`     | Prettier, check only (used in CI)                                              |
| `npm test`                 | Vitest unit tests + RLS integration tests (needs `supabase start` + `db:seed`) |
| `npm run test:watch`       | Vitest in watch mode                                                           |
| `npm run e2e`              | Playwright e2e tests (builds and boots the app first)                          |
| `npm run db:seed`          | Seed dummy hospitals/staff into the local Supabase instance                    |
| `npm run check:no-secrets` | Grep the built client bundle for a leaked service-role key                     |

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
                     auth routes (login, forgot/reset password, dashboard, admin)
src/components/      Shared UI components
src/lib/supabase/    Supabase clients: user-session (server.ts), the one
                     service-role client (service-role.ts), middleware helper
src/lib/auth/        getSessionProfile(), requireRole(), requireActiveTenant()
src/lib/audit/       logAudit() helper
src/types/           Hand-authored Database type (see file header re: regenerating)
docs/BRIEF.md        Full product spec
docs/phases/         Phase-by-phase task lists and acceptance criteria
supabase/            Migrations, config, email templates
scripts/seed.ts      Dev-only dummy data seeding (service-role, run via tsx)
tests/rls/           RLS integration tests, run against a real local Postgres
e2e/                 Playwright e2e tests
```

## Deployment notes

Not yet configured — deployment to Vercel (Mumbai/`bom1` region) lands
once staff invites (Phase 1c) and more of the core workflow exist.
