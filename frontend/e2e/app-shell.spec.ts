import { expect, test } from "@playwright/test";

// The app shell (header + sidebar) is shared across dashboard pages. These
// pages used to keep the sidebar permanently open on phones; they now use the
// shared responsive sidebar (slide-away on desktop, drawer on phones).
const pages = ["/privacy", "/roles", "/moderation/blocked-terms"];

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("axyra.login", "testchannel");
    window.localStorage.setItem("axyra.activeChannel", "testchannel");
  });
  await page.route(/your-backend\.onrender\.com|localhost:8080/, (route) => route.fulfill({ json: {} }));
});

for (const path of pages) {
  test(`sidebar behaves on ${path}`, async ({ page }, testInfo) => {
    await page.goto(path);
    const menuButton = page.getByRole("button", { name: /toggle navigation|open dashboard menu/i });
    const sidebarLink = page.getByRole("link", { name: "Commands" }).first();

    if (testInfo.project.name === "mobile") {
      // Closed by default on phones, so content gets the full width.
      await expect(sidebarLink).toBeHidden();
      await menuButton.click();
      await expect(sidebarLink).toBeVisible();
      await page.getByRole("button", { name: "Close", exact: true }).click();
      await expect(sidebarLink).toBeHidden();
      // No sideways scrolling.
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    } else {
      // Open by default on desktop; the menu button slides it fully away.
      await expect(sidebarLink).toBeVisible();
      await menuButton.click();
      await expect(sidebarLink).toBeHidden();
      await menuButton.click();
      await expect(sidebarLink).toBeVisible();
    }
  });
}
