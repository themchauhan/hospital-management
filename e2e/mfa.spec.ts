import { test, expect } from "@playwright/test";
import { generateTotp } from "./utils/totp";
import { resetMfaFactors } from "./utils/reset-mfa";

const DEMO_PASSWORD = "demo-password-123!";
// MFA is only mandatory for SUPER_ADMIN at the pilot stage (see
// src/lib/auth/mfa.ts) — HOSPITAL_ADMIN/RECEPTIONIST don't enforce it
// for now, so this spec exercises the enroll/verify/incorrect-code
// flows against the platform admin account instead.
const ADMIN_EMAIL = "super@platform.test";

// Both specs below share the same seeded account and its MFA
// enrollment state, so they must not run concurrently with each other
// (playwright.config.ts otherwise parallelizes across the whole suite).
test.describe.serial("MFA enrollment and verification", () => {
  test("a SUPER_ADMIN must enroll MFA on first login, then only re-verify on later logins", async ({
    page,
  }) => {
    // Guarantee this run exercises the enroll path regardless of
    // whether a previous `npm run e2e` run already enrolled this
    // account (local Supabase data persists across runs).
    await resetMfaFactors(ADMIN_EMAIL);

    await page.goto("/login");
    await page.getByLabel("Email").fill(ADMIN_EMAIL);
    await page.getByLabel("Password").fill(DEMO_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL(/\/mfa\/setup/);
    await expect(
      page.getByRole("heading", { name: "Set up two-factor authentication" }),
    ).toBeVisible();

    const secretCode = page.locator("code");
    await expect(secretCode).toBeVisible();
    const secret = (await secretCode.textContent())?.trim();
    expect(secret).toBeTruthy();

    await page.getByLabel("6-digit code").fill(generateTotp(secret!));
    await page.getByRole("button", { name: "Confirm" }).click();

    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole("heading", { name: "Super admin console" })).toBeVisible();

    // Sign out and back in: this time a verified factor already
    // exists, so it should challenge rather than ask to enroll again.
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/login$/);

    await page.getByLabel("Email").fill(ADMIN_EMAIL);
    await page.getByLabel("Password").fill(DEMO_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL(/\/mfa\/verify/);
    await expect(page.getByRole("heading", { name: "Verify it's you" })).toBeVisible();

    await page.getByLabel("6-digit code from your authenticator app").fill(generateTotp(secret!));
    await page.getByRole("button", { name: "Verify" }).click();

    await expect(page).toHaveURL(/\/admin$/);
  });

  test("an incorrect MFA code is rejected", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(ADMIN_EMAIL);
    await page.getByLabel("Password").fill(DEMO_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/mfa\/(setup|verify)/);

    const url = page.url();
    if (url.includes("/mfa/setup")) {
      await page.getByLabel("6-digit code").fill("000000");
      await page.getByRole("button", { name: "Confirm" }).click();
    } else {
      await page.getByLabel("6-digit code from your authenticator app").fill("000000");
      await page.getByRole("button", { name: "Verify" }).click();
    }

    await expect(page.getByText("Incorrect code")).toBeVisible();
    // Loosely matching /admin$/ against the full URL would also match
    // the still-present ?next=/admin query string, so check the
    // pathname specifically.
    expect(new URL(page.url()).pathname).not.toBe("/admin");
  });
});
