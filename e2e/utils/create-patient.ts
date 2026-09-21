import { expect, type Page } from "@playwright/test";

/**
 * Creates a patient via the UI and lands on their profile page.
 * Tolerates the possible-duplicate warning (Phase 2) generically,
 * rather than each spec trying to avoid every other spec's leftover
 * fixture names — local Supabase data persists across `npm run e2e`
 * runs, and different specs' name prefixes (e.g. "E2E Test Patient"
 * vs "E2E Visit Test Patient") can still fuzzy-match each other even
 * after each spec cleans up its own.
 */
export async function createPatientViaUi(
  page: Page,
  fields: { name: string; mobile?: string },
): Promise<void> {
  await page.goto("/dashboard/patients/new");
  await page.getByLabel("Name", { exact: true }).fill(fields.name);
  if (fields.mobile) {
    await page.getByLabel("Mobile").fill(fields.mobile);
  }
  await page.getByRole("button", { name: "Create patient" }).click();

  // Race the two possible outcomes rather than an instantaneous
  // isVisible() check, which can run before the server action's
  // response has been rendered either way.
  const duplicateWarning = page.getByText("This might already be an existing patient:");
  const outcome = await Promise.race([
    page
      .waitForURL(/\/dashboard\/patients\/[0-9a-f-]+$/, { timeout: 8_000 })
      .then(() => "redirected" as const),
    duplicateWarning.waitFor({ state: "visible", timeout: 8_000 }).then(() => "duplicate" as const),
  ]).catch(() => null);

  if (outcome === "duplicate") {
    await page.getByRole("button", { name: "This is a different person — create anyway" }).click();
  }

  await expect(page).toHaveURL(/\/dashboard\/patients\/[0-9a-f-]+$/, { timeout: 10_000 });
}
