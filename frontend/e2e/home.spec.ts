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

test("product tour tabs switch screenshots with arrow keys", async ({ page }) => {
  await page.goto("/");
  const tabs = page.getByRole("tablist", { name: "Dashboard pages" });
  await tabs.getByRole("tab", { name: "Dashboard" }).focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  const discord = tabs.getByRole("tab", { name: "Discord" });
  await expect(discord).toBeFocused();
  await expect(discord).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tabpanel").getByRole("img")).toHaveAttribute("alt", /Discord integration/);
});

test("FAQ answers expand and collapse", async ({ page }) => {
  await page.goto("/");
  const question = page.getByRole("button", { name: "Is AxyraBot free?" });
  await expect(question).toHaveAttribute("aria-expanded", "false");
  await question.click();
  await expect(question).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByText(/completely free/)).toBeVisible();
});

test("switch-bot tiles link to the importer", async ({ page }) => {
  await page.goto("/");
  for (const provider of ["nightbot", "streamelements", "fossabot"]) {
    await expect(page.locator(`a[href="/import?provider=${provider}"]`)).toBeVisible();
  }
});

test("chat demo filters can be toggled and the demo paused", async ({ page }) => {
  await page.goto("/");
  const links = page.getByRole("switch", { name: /Link protection/ });
  await expect(links).toHaveAttribute("aria-checked", "true");
  await links.click();
  await expect(links).toHaveAttribute("aria-checked", "false");

  const pause = page.getByRole("button", { name: "Pause chat demo" });
  await pause.click();
  await expect(page.getByRole("button", { name: "Play chat demo" })).toBeVisible();
});

test("chat demo removes a caught message and the bot replies", async ({ page }) => {
  await page.goto("/");
  const chat = page.getByRole("list", { name: "Example chat messages" });
  // The script includes a link-spam message within the first few lines.
  await expect(chat.getByText(/links aren't allowed here/)).toBeVisible({ timeout: 10_000 });
  await expect(chat.getByText("removed").first()).toBeVisible();
});
