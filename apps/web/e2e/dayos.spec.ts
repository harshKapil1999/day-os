import { expect, test } from "@playwright/test";

test("onboarding builds the first day", async ({ page }) => {
  await page.goto("/onboarding");
  await expect(page.getByText("When do you normally wake up?")).toBeVisible();
  for (let step = 0; step < 10; step += 1) await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Build a day around you.")).toBeVisible();
  await page.getByRole("button", { name: /Build my first day/i }).click();
  await expect(page).toHaveURL(/\/app\/today/);
  await expect(page.getByText("Shape of your day")).toBeVisible();
});

test("creates and completes a task", async ({ page }, testInfo) => {
  const taskName = `Prepare launch brief ${testInfo.project.name}`;
  await page.goto("/app/tasks");
  await page.getByRole("button", { name: /New task/i }).click();
  const input = page.getByPlaceholder("Name this task");
  await input.fill(taskName);
  await input.press("Enter");
  const row = page.getByRole("article").filter({ has: page.getByRole("heading", { name: taskName, exact: true }) }).first();
  await expect(row).toBeVisible();
  const completion = row.getByRole("button", { name: `Complete ${taskName}` });
  await completion.click();
  await expect(row).not.toBeVisible();
  await page.getByRole("button", { name: /Completed/ }).click();
  await expect(page.getByRole("article").filter({ has: page.getByRole("heading", { name: taskName, exact: true }) })).toBeVisible();
});

test("focus lifecycle completes without waiting", async ({ page }) => {
  await page.goto("/app/today");
  await page.locator(".timeline-row").getByRole("button", { name: /^Focus / }).first().click();
  await expect(page.getByText("Stay focused.")).toBeVisible();
  await page.getByRole("button", { name: "Finish" }).click();
  await expect(page.getByText("Did you complete what you planned?")).toBeVisible();
  await page.locator(".finish-card").getByRole("button", { name: "Completed", exact: true }).click();
  await page.locator(".finish-card .rating").getByRole("button", { name: "4" }).click();
  await expect(page.getByText("Did you complete what you planned?")).not.toBeVisible();
  await expect(page.getByText("Shape of your day")).toBeVisible();
});

test("edits and deletes a task without losing the saved plan", async ({ page }, testInfo) => {
  const original = `Plan weekly review ${testInfo.project.name}`;
  const updated = `Plan thoughtful weekly review ${testInfo.project.name}`;
  await page.goto("/app/tasks");
  await page.getByRole("button", { name: /New task/i }).click();
  await page.getByPlaceholder("Name this task").fill(original);
  await page.getByLabel("Estimated minutes").fill("45");
  await page.getByLabel("Life area").selectOption("LEARNING");
  await page.getByRole("button", { name: "Add task" }).click();
  let row = page.getByRole("article").filter({ has: page.getByRole("heading", { name: original, exact: true }) });
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: `More options for ${original}` }).click();
  await row.getByRole("button", { name: "Edit task" }).click();
  await page.getByLabel("Task title").fill(updated);
  await page.getByRole("button", { name: "Save task" }).click();
  row = page.getByRole("article").filter({ has: page.getByRole("heading", { name: updated, exact: true }) });
  await expect(row).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "All", exact: true }).click();
  row = page.getByRole("article").filter({ has: page.getByRole("heading", { name: updated, exact: true }) });
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: `More options for ${updated}` }).click();
  await row.getByRole("button", { name: "Delete task" }).click();
  await row.getByRole("button", { name: "Confirm delete" }).click();
  await expect(row).not.toBeVisible();
});

test("saves and reloads a daily reflection", async ({ page }) => {
  await page.goto("/app/today");
  await page.getByRole("button", { name: "Day 4 of 5" }).click();
  await page.getByRole("button", { name: "Energy 2 of 5" }).click();
  await page.getByPlaceholder("A small note for your future self").fill("Take a quiet break after lunch.");
  await page.getByRole("button", { name: /Save reflection|Update reflection/ }).click();
  await expect(page.getByText("Reflection saved for today.")).toBeVisible();
  await page.reload();
  await expect(page.getByPlaceholder("A small note for your future self")).toHaveValue("Take a quiet break after lunch.");
  await page.goto("/app/insights");
  await expect(page.getByText(/latest check-in showed low energy/i)).toBeVisible();
});

test("rebalances future work and keeps the timeline usable", async ({ page }) => {
  await page.goto("/app/today");
  await page.getByRole("button", { name: /Rebalance/i }).click();
  await expect(page.getByText("Today changed. Your remaining schedule was adjusted.")).toBeVisible();
  await expect(page.getByText("Shape of your day")).toBeVisible();
});

test("logs hydration optimistically", async ({ page }) => {
  await page.goto("/app/today");
  await page.getByRole("button", { name: /250 ml/i }).click();
  await expect(page.getByText(/\/ 3\.0 L/).first()).toBeVisible();
});

test("creates a habit and saves profile settings", async ({ page }, testInfo) => {
  const habitName = `Stretch after waking ${testInfo.project.name}`;
  await page.goto("/app/habits");
  await page.getByRole("button", { name: "New habit" }).click();
  await page.getByPlaceholder("e.g. Morning walk").fill(habitName);
  await page.getByRole("button", { name: "Save habit" }).click();
  const habit = page.locator("article").filter({ has: page.getByRole("heading", { name: habitName, exact: true }) });
  await expect(habit).toBeVisible();
  await habit.getByRole("button", { name: "Mark complete" }).click();
  await expect(habit.getByRole("button", { name: "Complete" })).toBeVisible();

  await page.goto("/app/settings");
  const displayName = `DayOS QA ${testInfo.project.name}`;
  await page.getByLabel("Display name").fill(displayName);
  await page.getByRole("button", { name: "Save and rebuild" }).click();
  await expect(page.getByRole("button", { name: "Saved" })).toBeVisible();
  await expect(page.getByText(displayName, { exact: true }).first()).toBeVisible();
});

test("renders real insights and calendar data", async ({ page }) => {
  await page.goto("/app/insights");
  await expect(page.getByText("Real signals from your saved plans, sessions, and rhythms.")).toBeVisible();
  await expect(page.getByText("Your real day, not a template")).toBeVisible();
  await page.goto("/app/calendar");
  await expect(page.getByRole("heading", { name: "Calendar" })).toBeVisible();
  await expect(page.getByText("Drag flexible activities by 15-minute increments. DayOS checks conflicts before saving.")).toBeVisible();
});

test("every app page is responsive without runtime errors", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "mobile-only assertion");
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  for (const route of ["/", "/onboarding", "/app/today", "/app/tasks", "/app/habits", "/app/calendar", "/app/insights", "/app/settings"]) {
    await page.goto(route);
    await page.waitForLoadState("networkidle");
    const dimensions = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
    expect(dimensions.scrollWidth, route).toBeLessThanOrEqual(dimensions.width + 1);
  }
  expect(pageErrors).toEqual([]);
});
