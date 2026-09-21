import { test, expect } from "@playwright/test";

test("home page loads", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Project scaffold is running." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Hospital & USG Records" })).toBeVisible();
});
