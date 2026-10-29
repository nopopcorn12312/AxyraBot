import { expect, test } from "@playwright/test";

// The dashboard needs a logged-in user and backend data. Fake both: a stored
// login, and canned responses for the activity feed (the full backend isn't
// running during tests).
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("axyra.login", "testchannel");
    window.localStorage.setItem("axyra.activeChannel", "testchannel");
  });
  const logs = Array.from({ length: 20 }, (_, i) => ({
    source: i % 3 === 0 ? "twitch" : "axyrabot",
    category: "test",
    description: `Updated stream settings: title="Test stream ${i}", category="Software and Game Development"`,
    timestamp: new Date(Date.now() - i * 3_600_000).toISOString(),
  }));
  await page.route("**/audit/logs**", (route) => route.fulfill({ json: { logs } }));
});

test("recent activity list stays inside its card", async ({ page }) => {
  await page.goto("/dashboard");
  const heading = page.getByRole("heading", { name: "Recent Activity" });
  await expect(heading).toBeVisible();
  await expect(page.getByText('title="Test stream 0"')).toBeVisible();

  const card = heading.locator("xpath=ancestor::div[contains(@class,'border-ax-subtle') and contains(@class,'bg-ax-section')][1]");
  const list = card.locator("ul");
  const cardBox = (await card.boundingBox())!;
  const listViewport = (await list.locator("xpath=..").boundingBox())!;

  // The visible list area never extends past the bottom of the card.
  expect(listViewport.y + listViewport.height).toBeLessThanOrEqual(cardBox.y + cardBox.height + 1);
});

test("recent activity list scrolls when it is longer than the card", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile", "On phones the page itself scrolls instead");
  await page.goto("/dashboard");
  await expect(page.getByText('title="Test stream 0"')).toBeVisible();
  const scroller = page.getByRole("heading", { name: "Recent Activity" })
    .locator("xpath=ancestor::div[contains(@class,'border-ax-subtle') and contains(@class,'bg-ax-section')][1]")
    .locator("ul")
    .locator("xpath=..");
  const { scrollHeight, clientHeight } = await scroller.evaluate((el) => ({
    scrollHeight: el.scrollHeight,
    clientHeight: el.clientHeight,
  }));
  expect(scrollHeight).toBeGreaterThan(clientHeight);
  // And the last entry can be scrolled into view.
  await page.getByText('title="Test stream 19"').scrollIntoViewIfNeeded();
  await expect(page.getByText('title="Test stream 19"')).toBeInViewport();
});
