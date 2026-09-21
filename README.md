# Hospital & USG Management SaaS

A multi-tenant web app for small Indian hospitals and diagnostic (USG)
centres — capture patient details and documents once, reuse them on
every repeat visit. See [`docs/BRIEF.md`](docs/BRIEF.md) for the full
product spec and [`CLAUDE.md`](CLAUDE.md) for the project's hard rules
(multi-tenancy, RLS, no hard deletes, etc.).

This repo is being built phase by phase — see
[`docs/phases/`](docs/phases). Current phase: **1a — project scaffold**.

## Tech stack

- [Next.js](https://nextjs.org) (App Router) + React + TypeScript
  (strict) + Tailwind CSS
- [Supabase](https://supabase.com) — Postgres, Auth, private Storage
  (introduced from Phase 1b onward)
- [Vitest](https://vitest.dev) for unit/integration tests,
  [Playwright](https://playwright.dev) for e2e tests
- Deploy target: [Vercel](https://vercel.com) (`bom1` / Mumbai region)

## Prerequisites

- [Node.js](https://nodejs.org) 20 or later
- npm 10 or later
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) —
  required to run Supabase locally (`supabase start`). Not needed just
  to run `npm run dev` against the placeholder scaffold in Phase 1a.

The Supabase CLI is installed as a project dev dependency (`npx
supabase ...` or `npm run supabase -- ...`), so no global install is
required.

## Getting started

```bash
git clone <repo-url>
cd hospital-management
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You should see the
Phase 1a placeholder dashboard page.

`.env.local` can stay empty for Phase 1a — no environment variables are
read yet. From Phase 1b onward you'll need real Supabase values in
`.env.local`; see `.env.example` for the list. Never commit
`.env.local` or paste real Supabase secrets into a prompt.

## Local Supabase (from Phase 1b onward)

Once the data model lands in a later phase:

```bash
npx supabase start   # boots local Postgres, Auth, Storage in Docker
npx supabase status  # prints local API URL and anon key for .env.local
npx supabase stop    # stop the local stack
```

## Scripts

| Command                | Purpose                                               |
| ---------------------- | ----------------------------------------------------- |
| `npm run dev`          | Start the Next.js dev server                          |
| `npm run build`        | Production build (also type-checks)                   |
| `npm run start`        | Run the production build                              |
| `npm run lint`         | ESLint                                                |
| `npm run typecheck`    | `tsc --noEmit`                                        |
| `npm run format`       | Prettier, writes changes                              |
| `npm run format:check` | Prettier, check only (used in CI)                     |
| `npm test`             | Vitest unit/integration tests                         |
| `npm run test:watch`   | Vitest in watch mode                                  |
| `npm run e2e`          | Playwright e2e tests (builds and boots the app first) |

Playwright browsers must be installed once per machine:

```bash
npx playwright install chromium
```

## CI

GitHub Actions (`.github/workflows/ci.yml`) runs on every push and PR:
install → lint → typecheck → unit tests → build, then a separate job
installs Playwright's Chromium and runs the e2e smoke test.

## Project structure

```
src/app/           Next.js App Router routes, layouts, error/404 pages
src/components/    Shared UI components
docs/BRIEF.md       Full product spec
docs/phases/        Phase-by-phase task lists and acceptance criteria
supabase/           Supabase CLI config and (later) migrations/seed data
e2e/                 Playwright e2e tests
```

## Deployment notes

Not yet configured — deployment to Vercel (Mumbai/`bom1` region) is set
up starting from the phase that introduces the Supabase-backed data
model, once there are real environment variables to wire up.
