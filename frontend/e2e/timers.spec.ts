import { expect, test } from "@playwright/test";

type Timer = Record<string, unknown> & { id: number; name: string; enabled: boolean };

// Fake backend: an in-memory list of timers behind /timers and /timers/delete.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("axyra.login", "testchannel");
    window.localStorage.setItem("axyra.activeChannel", "testchannel");
    window.sessionStorage.setItem("axyra.termsAccepted", "1");
  });
  // Everything else the page asks the backend for gets an empty answer.
  // Registered first: Playwright gives later routes priority.
  await page.route(/your-backend\.onrender\.com|localhost:8080/, (route) => route.fulfill({ json: {} }));
  let timers: Timer[] = [];
  let nextId = 1;
  await page.route(/\/timers(\/delete)?(\?|$)/, async (route) => {
    const req = route.request();
    if (req.method() === "GET") return route.fulfill({ json: { timers } });
    const body = req.postDataJSON();
    if (req.url().includes("/timers/delete")) {
      timers = timers.filter((t) => t.id !== body.id);
      return route.fulfill({ body: "ok" });
    }
    const saved = { ...body, id: body.id || nextId++, status: { last_sent_at: null, next_due_at: null, last_skip_reason: "" } };
    delete saved.login;
    timers = timers.some((t) => t.id === saved.id) ? timers.map((t) => (t.id === saved.id ? saved : t)) : [...timers, saved];
    return route.fulfill({ json: { timer: saved } });
  });
});

test("create, edit, disable and delete a timer", async ({ page }) => {
  await page.goto("/modules");
  const section = page.getByRole("region", { name: "Timers" });
  await expect(section.getByText("No timers yet")).toBeVisible();

  // Validation: empty messages are not allowed.
  await section.getByRole("button", { name: "New timer" }).click();
  const form = section.getByRole("form", { name: "New timer" });
  await form.getByLabel("Name").fill("Socials");
  await form.getByRole("button", { name: "Create timer" }).click();
  await expect(form.getByRole("alert")).toHaveText("Add at least one message.");

  await form.getByRole("textbox", { name: "Message 1" }).fill("Follow $(channel)!");
  await form.getByRole("button", { name: "Add another message" }).click();
  await form.getByRole("textbox", { name: "Message 2" }).fill("Join the Discord");
  await form.getByRole("radio", { name: "Random" }).click();
  await form.getByLabel("Interval (minutes)").fill("20");
  await form.getByRole("button", { name: "Create timer" }).click();

  await expect(form).toBeHidden();
  await expect(section.getByText("Socials")).toBeVisible();
  await expect(section.getByText("Every 20 min · 5+ messages in 10 min · random order · live only")).toBeVisible();

  // Edit
  await section.getByRole("button", { name: "Edit Socials" }).click();
  const editForm = section.getByRole("form", { name: "Edit timer Socials" });
  await editForm.getByLabel("Minimum chat messages").fill("0");
  await editForm.getByRole("button", { name: "Save timer" }).click();
  await expect(section.getByText("Every 20 min · no activity needed · random order · live only")).toBeVisible();

  // Disable
  const toggle = section.getByRole("switch", { name: "Socials enabled" });
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", "false");

  // Delete (with confirmation)
  await section.getByRole("button", { name: "Delete Socials" }).click();
  await section.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(section.getByText("No timers yet")).toBeVisible();
});

test("interval below the minimum is rejected", async ({ page }) => {
  await page.goto("/modules");
  const section = page.getByRole("region", { name: "Timers" });
  await section.getByRole("button", { name: "New timer" }).click();
  const form = section.getByRole("form", { name: "New timer" });
  await form.getByLabel("Name").fill("Too fast");
  await form.getByRole("textbox", { name: "Message 1" }).fill("hi");
  await form.getByLabel("Interval (minutes)").fill("2");
  await form.getByRole("button", { name: "Create timer" }).click();
  await expect(form.getByRole("alert")).toHaveText("Interval must be between 5 and 1440 minutes.");
});
