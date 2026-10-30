import { expect, test } from "@playwright/test";

test("terms notice links to the policies and stays dismissed for the session", async ({ page }) => {
  await page.goto("/");
  const notice = page.getByRole("region", { name: "Terms notice" });
  await expect(notice).toContainText("By using this site you agree to the Terms and Conditions and Privacy Policy");
  await expect(notice.getByRole("link", { name: "Terms and Conditions" })).toHaveAttribute("href", "/terms");
  await expect(notice.getByRole("link", { name: "Privacy Policy" })).toHaveAttribute("href", "/privacy");

  await notice.getByRole("button", { name: "Accept" }).click();
  await expect(notice).toBeHidden();

  // Still hidden on other pages and after a reload in the same session.
  await page.goto("/terms");
  await expect(page.getByRole("region", { name: "Terms notice" })).toBeHidden();
  await page.reload();
  await expect(page.getByRole("region", { name: "Terms notice" })).toBeHidden();
});

test("terms notice comes back in a new session", async ({ browser }) => {
  const first = await browser.newPage();
  await first.goto("/");
  await first.getByRole("button", { name: "Accept" }).click();
  await first.close();

  const second = await browser.newPage();
  await second.goto("/");
  await expect(second.getByRole("region", { name: "Terms notice" })).toBeVisible();
  await second.close();
});
