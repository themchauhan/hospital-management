import { test, expect } from "@playwright/test";
import { generateTotp } from "./utils/totp";
import { resetMfaFactors } from "./utils/reset-mfa";

// Credentials from scripts/seed.ts. Run `npx supabase start && npm run
// db:seed` before this spec — see README.md.
const DEMO_PASSWORD = "demo-password-123!";
// RECEPTIONIST doesn't require MFA (Phase 1c), so it's the simplest
// account for tests that are about login/session mechanics rather
// than MFA itself — see mfa.spec.ts for the MFA-specific flows.
const TENANT_EMAIL = "reception@sunrise.test";
const PLATFORM_ADMIN_EMAIL = "super@platform.test";

async function login(page: import("@playwright/test").Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
}

test("a tenant user logs in and lands on /dashboard", async ({ page }) => {
  await login(page, TENANT_EMAIL);
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByText(TENANT_EMAIL)).toBeVisible();
});

test("a platform admin logs in, completes MFA enrollment, and lands on /admin", async ({
  page,
}) => {
  // Guarantee the enroll path regardless of a previous e2e run having
  // already enrolled this account (local Supabase data persists
  // across `npm run e2e` runs).
  await resetMfaFactors(PLATFORM_ADMIN_EMAIL);
  await login(page, PLATFORM_ADMIN_EMAIL);

  // SUPER_ADMIN requires MFA (Phase 1c).
  await expect(page).toHaveURL(/\/mfa\/setup/);
  const secret = (await page.locator("code").textContent())?.trim();
  await page.getByLabel("6-digit code").fill(generateTotp(secret!));
  await page.getByRole("button", { name: "Confirm" }).click();

  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { name: "Super admin console" })).toBeVisible();
});

test("an incorrect password shows an error and does not navigate", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(TENANT_EMAIL);
  await page.getByLabel("Password").fill("wrong-password");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page.getByText("Incorrect email or password.")).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});

test("a deactivated account cannot log in", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("deactivated@sunrise.test");
  await page.getByLabel("Password").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page.getByText("This account has been deactivated.")).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});

test("signing out returns to a signed-out state", async ({ page }) => {
  await login(page, TENANT_EMAIL);
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();

  // Session is really gone, not just a client-side redirect.
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard/);
});

test("an unauthenticated visitor hitting /dashboard is redirected to /login", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard/);
});

test("a tenant user hitting /admin is redirected to /dashboard, not shown the admin console", async ({
  page,
}) => {
  await login(page, TENANT_EMAIL);
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto("/admin");
  await expect(page).toHaveURL(/\/dashboard$/);
});
