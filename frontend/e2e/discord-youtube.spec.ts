import { expect, test } from "@playwright/test";

type Saved = { youtube_channel: string; discord_channel_id: string };

// Fake backend for the Discord settings page. `posts` records YouTube saves.
async function setup(page: import("@playwright/test").Page, existing: Record<string, string> | null) {
  const posts: Saved[] = [];
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
    route.fulfill({ json: { channels: [{ id: "c1", name: "general", type: 0 }, { id: "c2", name: "videos", type: 0 }] } }),
  );
  await page.route(/\/discord\/youtube/, (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({ json: existing ?? { youtube_channel_id: "", youtube_name: "", discord_channel_id: "" } });
    }
    const body = route.request().postDataJSON() as Saved;
    posts.push(body);
    if (body.youtube_channel.includes("missing")) {
      return route.fulfill({ status: 400, body: "we couldn't find that YouTube channel. Paste your channel's link, like youtube.com/@yourname" });
    }
    return route.fulfill({ json: { youtube_channel_id: "UCabc", youtube_name: "My Channel", discord_channel_id: body.discord_channel_id } });
  });
  return posts;
}

test("connect a YouTube channel and choose where uploads are posted", async ({ page }) => {
  const posts = await setup(page, null);
  await page.goto("/discord/settings");

  const discordChannel = page.getByRole("combobox", { name: "YouTube Uploads" });
  await expect(discordChannel).toHaveValue("");
  await expect(discordChannel.locator("option")).toHaveText(["Disabled", "#general", "#videos"]);

  // A channel YouTube doesn't know shows the server's explanation.
  await page.getByLabel("Your YouTube channel").fill("@missing");
  await discordChannel.selectOption({ label: "#videos" });
  await page.getByRole("button", { name: "Save Settings" }).click();
  await expect(page.getByText("We couldn't find that YouTube channel.")).toBeVisible();

  await page.getByLabel("Your YouTube channel").fill("youtube.com/@mychannel");
  await page.getByRole("button", { name: "Save Settings" }).click();
  await expect(page.getByText("Connected to My Channel")).toBeVisible();
  expect(posts.at(-1)).toMatchObject({ guild_id: "g1", youtube_channel: "youtube.com/@mychannel", discord_channel_id: "c2" });

  // Nothing changed, so saving again doesn't contact YouTube.
  const count = posts.length;
  await page.getByRole("button", { name: "Save Settings" }).click();
  await expect(page.getByText("Saved!").first()).toBeVisible();
  expect(posts).toHaveLength(count);
});

test("shows the saved channel, and clearing it disconnects", async ({ page }) => {
  const posts = await setup(page, { youtube_channel_id: "UCabc", youtube_name: "My Channel", discord_channel_id: "c2" });
  await page.goto("/discord/settings");

  await expect(page.getByLabel("Your YouTube channel")).toHaveValue("https://www.youtube.com/channel/UCabc");
  await expect(page.getByRole("combobox", { name: "YouTube Uploads" })).toHaveValue("c2");
  await expect(page.getByText("Connected to My Channel")).toBeVisible();

  await page.getByLabel("Your YouTube channel").fill("");
  await page.getByRole("combobox", { name: "YouTube Uploads" }).selectOption({ label: "Disabled" });
  await page.getByRole("button", { name: "Save Settings" }).click();
  await expect.poll(() => posts.at(-1)).toMatchObject({ youtube_channel: "", discord_channel_id: "" });
});

test("the upload message can be edited", async ({ page }) => {
  await setup(page, null);
  await page.goto("/discord/settings");
  await page.getByRole("combobox", { name: "YouTube Uploads" }).waitFor();
  await page.getByText("YouTube Uploads").locator("xpath=following-sibling::button").click();
  await expect(page.getByText("Edit YouTube Upload Message")).toBeVisible();
  await expect(page.getByRole("textbox").last()).toHaveValue(/\$\(title\)/);
  await expect(page.getByText("Link to the video")).toBeVisible();
});
