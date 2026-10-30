import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => window.sessionStorage.setItem("axyra.termsAccepted", "1"));
});

test("docs are readable without signing in", async ({ page }) => {
  await page.goto("/docs");
  await expect(page).toHaveURL(/\/docs$/);
  await expect(page.getByRole("heading", { level: 1, name: "How to use AxyraBot" })).toBeVisible();
  // Signed-out visitors get a login button, not the dashboard menu.
  await expect(page.getByRole("link", { name: "Login with Twitch" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Toggle navigation" })).toHaveCount(0);
  // Variables are grouped by what they do.
  for (const group of ["People", "Channel and stream", "Counters", "Birthdays and dates", "Moderation log (Discord)"]) {
    await expect(page.getByRole("heading", { level: 3, name: group })).toBeVisible();
  }
  await expect(page.getByRole("region", { name: "People variables" }).getByText("$(user)", { exact: true })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test("old /api-docs links redirect to /docs", async ({ page }) => {
  await page.goto("/api-docs");
  await expect(page).toHaveURL(/\/docs$/);
});

test("signed-in sidebar says Docs", async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("axyra.login", "testchannel");
    window.localStorage.setItem("axyra.activeChannel", "testchannel");
  });
  await page.route(/your-backend\.onrender\.com|localhost:8080/, (route) => route.fulfill({ json: {} }));
  await page.goto("/dashboard");
  // Wait for the page to read the stored login (it then stops asking to
  // connect), so the menu button is live before it's pressed.
  await expect(page.getByText("Connect with Twitch to see recent activity")).toHaveCount(0);
  if (testInfo.project.name === "mobile") await page.getByRole("button", { name: /toggle navigation|open dashboard menu/i }).click();
  const link = page.getByRole("link", { name: "Docs", exact: true });
  await expect(link).toHaveAttribute("href", "/docs");
  await expect(page.getByText("API Docs")).toHaveCount(0);
});
