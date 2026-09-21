import { test, expect } from "@playwright/test";

// Credentials from scripts/seed.ts. Run `npx supabase start && npm run
// db:seed` before this spec — see README.md.
const DEMO_PASSWORD = "demo-password-123!";
const HOSPITAL_ADMIN_EMAIL = "admin@sunrise.test";
const PLATFORM_ADMIN_EMAIL = "super@platform.test";

async function login(page: import("@playwright/test").Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
}

test("a tenant user logs in and lands on /dashboard", async ({ page }) => {
  await login(page, HOSPITAL_ADMIN_EMAIL);
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByText(HOSPITAL_ADMIN_EMAIL)).toBeVisible();
});

test("a platform admin logs in and lands on /admin", async ({ page }) => {
  await login(page, PLATFORM_ADMIN_EMAIL);
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { name: "Super admin console" })).toBeVisible();
});

test("an incorrect password shows an error and does not navigate", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(HOSPITAL_ADMIN_EMAIL);
  await page.getByLabel("Password").fill("wrong-password");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page.getByText("Incorrect email or password.")).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});

test("signing out returns to a signed-out state", async ({ page }) => {
  await login(page, HOSPITAL_ADMIN_EMAIL);
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
  await login(page, HOSPITAL_ADMIN_EMAIL);
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto("/admin");
  await expect(page).toHaveURL(/\/dashboard$/);
});
