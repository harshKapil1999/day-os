import { expect, test } from "@playwright/test";

test("onboarding builds the first day", async ({ page }) => {
  await page.goto("/onboarding");
  await expect(page.getByText("When do you normally wake up?")).toBeVisible();
  for (let step = 0; step < 8; step += 1) await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Your day is ready.")).toBeVisible();
  await page.getByRole("button", { name: /Build my first day/i }).click();
  await expect(page).toHaveURL(/\/app\/today/);
  await expect(page.getByText("Shape of your day")).toBeVisible();
});

test("creates and completes a task", async ({ page }) => {
  await page.goto("/app/tasks");
  await page.getByRole("button", { name: /New task/i }).click();
  const input = page.getByPlaceholder("Name this task");
  await input.fill("Prepare launch brief");
  await input.press("Enter");
  const row = page.getByRole("article").filter({ has: page.getByRole("heading", { name: "Prepare launch brief", exact: true }) }).first();
  await expect(row).toBeVisible();
  const completion = row.getByRole("button").first();
  await completion.click();
  await expect(completion).toHaveClass(/done/);
});

test("focus lifecycle completes without waiting", async ({ page }) => {
  await page.goto("/app/today");
  await page.getByRole("button", { name: /focus/i }).first().click();
  await expect(page.getByText("Stay focused.")).toBeVisible();
  await page.getByRole("button", { name: "Finish" }).click();
  await expect(page.getByText("Did you complete what you planned?")).toBeVisible();
  await page.locator(".finish-card").getByRole("button", { name: "Completed", exact: true }).click();
  await expect(page.getByText("Shape of your day")).toBeVisible();
});

test("rebalances future work and keeps the timeline usable", async ({ page }) => {
  await page.goto("/app/today");
  await page.getByRole("button", { name: /Rebalance/i }).click();
  await expect(page.getByText("Today changed. Your remaining schedule was adjusted.")).toBeVisible();
  await expect(page.getByText("Team stand-up")).toBeVisible();
});

test("logs hydration optimistically", async ({ page }) => {
  await page.goto("/app/today");
  await page.getByRole("button", { name: /250 ml/i }).click();
  await expect(page.getByText(/\/ 3\.0 L/).first()).toBeVisible();
});

test("mobile app shell has no horizontal overflow", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "mobile-only assertion");
  await page.goto("/app/today");
  const dimensions = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.width + 1);
});
