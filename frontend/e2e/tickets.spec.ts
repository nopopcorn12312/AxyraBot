import { expect, test } from "@playwright/test";

// Fake backend for the Discord settings page: one server with two categories.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("axyra.login", "testchannel");
    window.localStorage.setItem("axyra.activeChannel", "testchannel");
    window.sessionStorage.setItem("axyra.termsAccepted", "1");
  });
  // Registered first: Playwright gives later routes priority.
  await page.route(/your-backend\.onrender\.com|localhost:8080/, (route) => route.fulfill({ json: {} }));
  await page.route(/\/discord\/guilds\?/, (route) =>
    route.fulfill({ json: { guilds: [{ id: "g1", name: "Test Server", icon: "" }], discord_linked: true } }),
  );
  await page.route(/\/discord\/channels\?/, (route) =>
    route.fulfill({
      json: {
        channels: [
          { id: "c1", name: "general", type: 0 },
          { id: "cat-open", name: "Open Tickets", type: 4 },
          { id: "cat-closed", name: "Closed Tickets", type: 4 },
        ],
      },
    }),
  );
});

test("choose where closed tickets go and save it", async ({ page }) => {
  let saved: Record<string, unknown> | null = null;
  await page.route(/\/discord\/tickets\/config/, (route) => {
    if (route.request().method() === "POST") {
      saved = route.request().postDataJSON();
      return route.fulfill({ body: "ok" });
    }
    return route.fulfill({
      json: { guild_id: "g1", panel_channel_id: "c1", category_id: "cat-open", support_role_ids: [], closed_category_id: "" },
    });
  });

  await page.goto("/discord/settings");
  const picker = page.locator("#ticket-closed-location");
  await expect(picker).toHaveValue("");
  await expect(picker.locator("option")).toHaveText(["Keep it where it is", "Move to Open Tickets", "Move to Closed Tickets"]);
  // Ticket logging is gone, so there's no log channel to pick.
  await expect(page.getByText("Log Channel", { exact: false })).toHaveCount(0);

  await picker.selectOption({ label: "Move to Closed Tickets" });
  await page.getByRole("button", { name: "Save Config" }).click();
  await expect.poll(() => saved).toMatchObject({ closed_category_id: "cat-closed" });
  expect(saved).not.toHaveProperty("log_channel_id");
  expect(saved).not.toHaveProperty("closed_action");
});

test("loads the saved closed-ticket category", async ({ page }) => {
  await page.route(/\/discord\/tickets\/config/, (route) =>
    route.fulfill({ json: { guild_id: "g1", panel_channel_id: "c1", closed_category_id: "cat-closed", support_role_ids: [] } }),
  );
  await page.goto("/discord/settings");
  await expect(page.locator("#ticket-closed-location")).toHaveValue("cat-closed");
});
