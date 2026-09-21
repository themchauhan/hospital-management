import { defineConfig, devices } from "@playwright/test";

// e2e/utils/reset-mfa.ts needs the service-role key directly (it's a
// test-only utility, not part of the app). Next.js loads .env.local
// on its own for the webServer process, but the Playwright test
// process needs it loaded explicitly.
try {
  process.loadEnvFile(".env.local");
} catch {
  // No .env.local yet — fine for specs that don't need it.
}

export default defineConfig({
  testDir: "./e2e",
  // Not fully parallel: every spec shares one Next.js server and one
  // local Supabase instance (not per-worker isolated), and several
  // specs sign in as the same seeded account. Running 2+ workers
  // against that shared backend produced intermittent session-loss
  // flakiness under load (confirmed: reliable at workers=1, flaky at
  // the default). A handful of e2e specs running serially is fast
  // enough that the parallelism isn't worth the flakiness here.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run build && npm run start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
