import { test, expect } from "@playwright/test";
import { generateTotp } from "./utils/totp";
import { resetMfaFactors } from "./utils/reset-mfa";

const DEMO_PASSWORD = "demo-password-123!";
const ADMIN_EMAIL = "admin@sunrise.test";

test("a hospital admin invites staff and can deactivate/reactivate them", async ({ page }) => {
  // Guarantee the enroll path regardless of a previous e2e run having
  // already enrolled this account.
  await resetMfaFactors(ADMIN_EMAIL);

  await page.goto("/login");
  await page.getByLabel("Email").fill(ADMIN_EMAIL);
  await page.getByLabel("Password").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();

  // First login for this seeded account in this spec run — HOSPITAL_ADMIN
  // requires MFA (Phase 1c).
  await expect(page).toHaveURL(/\/mfa\/setup/);
  const secret = (await page.locator("code").textContent())?.trim();
  await page.getByLabel("6-digit code").fill(generateTotp(secret!));
  await page.getByRole("button", { name: "Confirm" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.getByRole("link", { name: "Manage staff →" }).click();
  await expect(page).toHaveURL(/\/dashboard\/staff$/);

  const invitedEmail = `invitee-${Date.now()}@sunrise.test`;
  await page.getByLabel("Name").fill("Demo Invitee");
  await page.getByLabel("Email").fill(invitedEmail);
  await page.getByLabel("Role").selectOption("RECEPTIONIST");
  await page.getByRole("button", { name: "Send invite" }).click();

  await expect(page.getByText(`Invited ${invitedEmail}.`)).toBeVisible();

  const row = page.locator("tr", { hasText: invitedEmail });
  await expect(row).toBeVisible();
  await expect(row.getByText("Receptionist")).toBeVisible();
  await expect(row.getByText("Active")).toBeVisible();

  await row.getByRole("button", { name: "Deactivate" }).click();
  await expect(
    page.locator("tr", { hasText: invitedEmail }).getByText("Deactivated"),
  ).toBeVisible();

  await page
    .locator("tr", { hasText: invitedEmail })
    .getByRole("button", { name: "Reactivate" })
    .click();
  await expect(page.locator("tr", { hasText: invitedEmail }).getByText("Active")).toBeVisible();
});
