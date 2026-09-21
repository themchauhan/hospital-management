# Phase 1a — Project scaffold & tooling

## Tasks

- [ ] Next.js (App Router) + TypeScript (strict) + Tailwind CSS
- [ ] ESLint + Prettier configured; `npm run lint` clean
- [ ] Supabase CLI set up for local dev (`supabase init`, local
      Postgres via Docker)
- [ ] Base layout, nav shell (placeholder links only), 404/error pages
- [ ] `.env.example` with every variable the app needs, no real values
- [ ] CI (GitHub Actions or equivalent): install, lint, typecheck,
      build, on every push
- [ ] `README.md`: local setup steps from clone to running app
- [ ] Vitest configured with one passing sample test
- [ ] Playwright configured with one passing smoke test (loads home
      page)

## Acceptance criteria

- `npm run build` succeeds
- `npm run lint` passes
- CI is green on a fresh clone
- A new developer can go from `git clone` to a running local app using
  only the README
