import { expect, test } from "@playwright/test";

test("home page loads with the main heading", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/AxyraBot/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("home page has no horizontal scroll", async ({ page }) => {
  await page.goto("/");
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test("dashboard redirects logged-out visitors home", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/$/);
});
